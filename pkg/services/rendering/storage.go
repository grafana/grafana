package rendering

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/util"
)

var ErrNoStaticImages = errors.New("static rendering images unavailable")
var ErrResultTooLarge = errors.New("rendered result exceeds memory limit")

type ResultStore interface {
	Store(context.Context, RenderType, io.Reader) (*Result, error)
	Image(string) (*Result, error)
}

type FileStore struct {
	ImagesDir string
	PDFsDir   string
	CSVsDir   string
	HomePath  string
}

func (s FileStore) Store(ctx context.Context, kind RenderType, body io.Reader) (*Result, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	var dir string
	switch kind {
	case RenderPDF:
		dir = s.PDFsDir
	case RenderCSV:
		dir = s.CSVsDir
	default:
		dir = s.ImagesDir
		kind = RenderPNG
	}

	name, err := util.GetRandomString(20)
	if err != nil {
		return nil, err
	}

	path, err := filepath.Abs(filepath.Join(dir, name+"."+string(kind)))
	if err != nil {
		return nil, err
	}

	//nolint:gosec // The directory is configured by the operator and the filename is generated above.
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return nil, err
	}

	_, copyErr := io.Copy(f, body)
	closeErr := f.Close()
	if err := errors.Join(copyErr, closeErr); err != nil {
		return nil, fmt.Errorf("writing rendered result: %w", err)
	}

	return &Result{FilePath: path}, nil
}

func (s FileStore) Image(name string) (*Result, error) {
	path := filepath.Join(s.HomePath, "public", "img", name)
	if _, err := os.Stat(path); err != nil {
		return nil, err
	}

	return &Result{FilePath: path}, nil
}

// MemoryStore bounds each response. Callers own Data and must release it after use.
type MemoryStore struct{ MaxBytes int64 }

func (s MemoryStore) Store(ctx context.Context, _ RenderType, body io.Reader) (*Result, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	if s.MaxBytes <= 0 {
		return nil, errors.New("positive rendering memory limit required")
	}

	data, err := io.ReadAll(io.LimitReader(body, s.MaxBytes))
	if err != nil {
		return nil, err
	}

	var extra [1]byte
	n, err := io.ReadFull(body, extra[:])
	if n != 0 {
		return nil, ErrResultTooLarge
	}

	if err != nil && !errors.Is(err, io.EOF) {
		return nil, err
	}

	return &Result{Data: data}, nil
}

func (MemoryStore) Image(string) (*Result, error) { return nil, ErrNoStaticImages }
