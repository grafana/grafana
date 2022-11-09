package supportbundlesimpl

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/supportbundles"
)

type bundleResult struct {
	path string
	err  error
}

func (s *Service) startBundleWork(ctx context.Context, collectors []string, uid string) {
	result := make(chan bundleResult)
	go func() {
		sbFilePath, err := s.bundle(ctx, collectors, uid)
		if err != nil {
			result <- bundleResult{err: err}
		}
		result <- bundleResult{
			path: sbFilePath,
		}
		close(result)
	}()

	select {
	case <-ctx.Done():
		s.log.Warn("Context cancelled while collecting support bundle")
		if err := s.store.Update(ctx, uid, supportbundles.StateTimeout, ""); err != nil {
			s.log.Error("failed to update bundle after timeout")
		}
		return
	case r := <-result:
		if r.err != nil {
			if err := s.store.Update(ctx, uid, supportbundles.StateError, ""); err != nil {
				s.log.Error("failed to update bundle after error")
			}
			return
		}
		if err := s.store.Update(ctx, uid, supportbundles.StateComplete, r.path); err != nil {
			s.log.Error("failed to update bundle after completion")
		}
		return
	}
}

func (s *Service) bundle(ctx context.Context, collectors []string, uid string) (string, error) {
	lookup := make(map[string]bool, len(collectors))
	for _, c := range collectors {
		lookup[c] = true
	}

	sbDir, err := os.MkdirTemp("", "")
	if err != nil {
		return "", err
	}

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
			if err := os.WriteFile(filepath.Join(sbDir, item.Filename), item.FileBytes, 0600); err != nil {
				s.log.Warn("Failed to collect support bundle item", "error", err)
			}
		}
	}

	// create tar.gz file
	var buf bytes.Buffer
	errCompress := compress(sbDir, &buf)
	if errCompress != nil {
		return "", errCompress
	}

	finalFilePath := filepath.Join(sbDir, fmt.Sprintf("%s.tar.gz", uid))

	// write the .tar.gzip
	fileToWrite, err := os.OpenFile(finalFilePath, os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(fileToWrite, &buf); err != nil {
		return "", err
	}

	return finalFilePath, nil
}

func compress(src string, buf io.Writer) error {
	// tar > gzip > buf
	zr := gzip.NewWriter(buf)
	tw := tar.NewWriter(zr)

	// walk through every file in the folder
	filepath.Walk(src, func(file string, fi os.FileInfo, err error) error {
		// if not a dir, write file content
		if !fi.IsDir() {
			// generate tar header
			header, err := tar.FileInfoHeader(fi, file)
			if err != nil {
				return err
			}

			header.Name = filepath.ToSlash("/bundle/" + header.Name)

			// write header
			if err := tw.WriteHeader(header); err != nil {
				return err
			}
			data, err := os.Open(file)
			if err != nil {
				return err
			}
			if _, err := io.Copy(tw, data); err != nil {
				return err
			}
		}
		return nil
	})

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
