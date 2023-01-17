package supportbundlesimpl

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"io"
	"path/filepath"
	"runtime/debug"
	"time"

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
				s.log.Error("support bundle collector panic", "err", err, "stack", string(debug.Stack()))
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
			s.log.Error("failed to update bundle after timeout")
		}
		return
	case r := <-result:
		if r.err != nil {
			s.log.Error("failed to make bundle", "error", r.err, "uid", uid)
			if err := s.store.Update(ctx, uid, supportbundles.StateError, nil); err != nil {
				s.log.Error("failed to update bundle after error")
			}
			return
		}
		if err := s.store.Update(ctx, uid, supportbundles.StateComplete, r.tarBytes); err != nil {
			s.log.Error("failed to update bundle after completion")
		}
		return
	}
}

func (s *Service) bundle(ctx context.Context, collectors []string, uid string) ([]byte, error) {
	lookup := make(map[string]bool, len(collectors))
	for _, c := range collectors {
		lookup[c] = true
	}

	files := map[string][]byte{}

	for _, collector := range s.collectors {
		if !lookup[collector.UID] && !collector.IncludedByDefault {
			continue
		}
		item, err := collector.Fn(ctx)
		if err != nil {
			s.log.Warn("Failed to collect support bundle item", "error", err)
		}

		// write item to file
		if item != nil {
			files[item.Filename] = item.FileBytes
		}
	}

	// create tar.gz file
	var buf bytes.Buffer
	errCompress := compress(files, &buf)
	if errCompress != nil {
		return nil, errCompress
	}

	return buf.Bytes(), nil
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
