package service

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

func (s *SupportBundleService) CreateSupportBundle(ctx context.Context) (string, error) {
	newUID, err := uuid.NewRandom()
	if err != nil {
	}

	uid := newUID.String()
	s.kvStore.Set(ctx, uid, "pending")

	go s.createBundleWrap(ctx, uid)

	return uid, nil
}

func (s *SupportBundleService) createBundleWrap(ctx context.Context, uid string) {
	result := make(chan string, 1)
	go func() {
		sbFilePath, err := s.createBundle(ctx, uid)
		if err != nil {
			result <- err.Error()
		}
		result <- sbFilePath
	}()

	select {
	case <-time.After(20 * time.Minute):
		s.log.Warn("Timed out collecting support bundle")
	case <-ctx.Done():
		s.log.Warn("Context cancelled while collecting support bundle")
	case <-result:
		s.kvStore.Set(ctx, uid, "pending")
		return
	}
}

func (s *SupportBundleService) createBundle(ctx context.Context, uid string) (string, error) {
	sbDir, err := os.MkdirTemp("", "")
	if err != nil {
		return "", err
	}

	for _, collector := range s.collectors {
		item, err := collector(ctx)
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
	fileToWrite, err := os.OpenFile(finalFilePath, os.O_CREATE|os.O_RDWR, os.FileMode(600))
	if err != nil {
		panic(err)
	}
	if _, err := io.Copy(fileToWrite, &buf); err != nil {
		panic(err)
	}

	return finalFilePath, nil
}

func compress(src string, buf io.Writer) error {
	// tar > gzip > buf
	zr := gzip.NewWriter(buf)
	tw := tar.NewWriter(zr)

	// walk through every file in the folder
	filepath.Walk(src, func(file string, fi os.FileInfo, err error) error {
		// generate tar header
		header, err := tar.FileInfoHeader(fi, file)
		if err != nil {
			return err
		}

		// must provide real name
		// (see https://golang.org/src/archive/tar/common.go?#L626)
		header.Name = filepath.ToSlash(file)

		// write header
		if err := tw.WriteHeader(header); err != nil {
			return err
		}
		// if not a dir, write file content
		if !fi.IsDir() {
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

func (s *SupportBundleService) ListSupportBundles() {
}

func (s *SupportBundleService) RetrieveSupportBundlePath() {
}
