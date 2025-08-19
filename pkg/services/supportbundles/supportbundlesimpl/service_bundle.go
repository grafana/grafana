package supportbundlesimpl

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"runtime/debug"
	"time"

	"filippo.io/age"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/services/supportbundles"
)

var ErrCollectorPanicked = errors.New("collector panicked")

type bundleResult struct {
	tarBytes []byte
	err      error
}

func (s *Service) startBundleWork(ctx context.Context, collectors []string, uid string) {
	result := make(chan bundleResult)

	go func() {
		defer func() {
			if err := recover(); err != nil {
				s.log.Error("Support bundle collector panic", "err", err, "stack", string(debug.Stack()))
				result <- bundleResult{err: ErrCollectorPanicked}
			}
		}()

		bundleBytes, err := s.bundle(ctx, collectors, uid)
		if err != nil {
			result <- bundleResult{err: err}
		}
		result <- bundleResult{tarBytes: bundleBytes}
		close(result)
	}()

	select {
	case <-ctx.Done():
		s.log.Warn("Context cancelled while collecting support bundle")
		if err := s.store.Update(ctx, uid, supportbundles.StateTimeout, nil); err != nil {
			s.log.Error("Failed to update bundle after timeout")
		}
		return
	case r := <-result:
		if r.err != nil {
			s.log.Error("Failed to make bundle", "error", r.err, "uid", uid)
			if err := s.store.Update(ctx, uid, supportbundles.StateError, nil); err != nil {
				s.log.Error("Failed to update bundle after error")
			}
			return
		}
		if err := s.store.Update(ctx, uid, supportbundles.StateComplete, r.tarBytes); err != nil {
			s.log.Error("Failed to update bundle after completion")
		}
		return
	}
}

func (s *Service) bundle(ctx context.Context, collectors []string, uid string) ([]byte, error) {
	ctxTracer, span := s.tracer.Start(ctx, "SupportBundle.bundle")
	span.SetAttributes(attribute.String("SupportBundle.bundle.uid", uid))
	defer span.End()

	lookup := make(map[string]bool, len(collectors))
	for _, c := range collectors {
		lookup[c] = true
	}

	files := map[string][]byte{}

	for _, collector := range s.bundleRegistry.Collectors() {
		collectorEnabled := true
		if collector.EnabledFn != nil {
			collectorEnabled = collector.EnabledFn()
		}

		if (!lookup[collector.UID] && !collector.IncludedByDefault) || !collectorEnabled {
			continue
		}

		// Trace the collector run
		ctxBundler, span := s.tracer.Start(ctxTracer, "SupportBundle.bundle.collector")
		span.SetAttributes(attribute.String("SupportBundle.bundle.collector.uid", collector.UID))

		item, err := collector.Fn(ctxBundler)
		if err != nil {
			s.log.Warn("Failed to collect support bundle item", "error", err, "collector", collector.UID)
		}

		// write item to file
		if item != nil {
			files[item.Filename] = item.FileBytes
		}

		span.End()
	}

	// create tar.gz file
	var buf bytes.Buffer
	errCompress := compress(files, &buf)
	if errCompress != nil {
		return nil, errCompress
	}

	final := buf
	if len(s.encryptionPublicKeys) > 0 {
		var err error
		final, err = encrypt(buf, s.encryptionPublicKeys...)
		if err != nil {
			return nil, err
		}
	}

	return final.Bytes(), nil
}

func encrypt(buf bytes.Buffer, publicKeys ...string) (bytes.Buffer, error) {
	final := bytes.Buffer{}
	recipients := make([]age.Recipient, 0, len(publicKeys))
	for _, key := range publicKeys {
		recipient, err := age.ParseX25519Recipient(key)
		if err != nil {
			return final, fmt.Errorf("unable to parse support bundle recipient public key: %w", err)
		}
		recipients = append(recipients, recipient)
	}

	w, err := age.Encrypt(&final, recipients...)
	if err != nil {
		return final, fmt.Errorf("unable to open support bundle encryption header: %w", err)
	}

	if _, err = w.Write(buf.Bytes()); err != nil {
		return final, fmt.Errorf("unable to write support bundle encryption: %w", err)
	}

	if err := w.Close(); err != nil {
		return final, fmt.Errorf("unable to close support bundle encryption: %w", err)
	}

	return final, nil
}

func compress(files map[string][]byte, buf io.Writer) error {
	// tar > gzip > buf
	zr := gzip.NewWriter(buf)
	tw := tar.NewWriter(zr)

	for name, data := range files {
		header := &tar.Header{
			Name:    name,
			ModTime: time.Now(),
			Mode:    int64(0o644),
			Size:    int64(len(data)),
		}

		header.Name = filepath.ToSlash("/bundle/" + header.Name)
		// write header
		if err := tw.WriteHeader(header); err != nil {
			return err
		}

		if _, err := io.Copy(tw, bytes.NewReader(data)); err != nil {
			return err
		}
	}

	// produce tar
	if err := tw.Close(); err != nil {
		return err
	}
	// produce gzip
	if err := zr.Close(); err != nil {
		return err
	}
	//
	return nil
}
