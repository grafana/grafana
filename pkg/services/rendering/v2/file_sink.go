package v2

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type FileSinkInput struct {
	ImagesDirectory string
	CSVsDirectory   string
	PDFsDirectory   string
}

type FileSink struct {
	imagesDirectory outputDirectory
	csvsDirectory   outputDirectory
	pdfsDirectory   outputDirectory
}

type outputDirectory struct {
	path string
}

type FileResult struct {
	path     string
	fileName fileName
}

func NewFileSink(input FileSinkInput) (*FileSink, error) {
	images, err := parseOutputDirectory("images", input.ImagesDirectory)
	if err != nil {
		return nil, err
	}
	csvs, err := parseOutputDirectory("CSVs", input.CSVsDirectory)
	if err != nil {
		return nil, err
	}
	pdfs, err := parseOutputDirectory("PDFs", input.PDFsDirectory)
	if err != nil {
		return nil, err
	}
	return &FileSink{imagesDirectory: images, csvsDirectory: csvs, pdfsDirectory: pdfs}, nil
}

func parseOutputDirectory(name, path string) (outputDirectory, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return outputDirectory{}, fmt.Errorf("parse %s output directory: path is required", name)
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return outputDirectory{}, fmt.Errorf("parse %s output directory: %w", name, err)
	}
	if err := os.MkdirAll(absolute, 0o700); err != nil {
		return outputDirectory{}, fmt.Errorf("create %s output directory: %w", name, err)
	}
	return outputDirectory{path: absolute}, nil
}

func (s *FileSink) Write(result *Result) (FileResult, error) {
	if result == nil {
		return FileResult{}, errors.New("write renderer result: result is required")
	}

	directory := s.imagesDirectory
	extension := "png"
	switch result.RenderType() {
	case RenderCSV:
		directory = s.csvsDirectory
		extension = "csv"
	case RenderPDF:
		directory = s.pdfsDirectory
		extension = "pdf"
	case RenderPNG:
	}

	file, err := os.CreateTemp(directory.path, "render-*."+extension)
	if err != nil {
		return FileResult{}, fmt.Errorf("create renderer output file: %w", err)
	}
	path := file.Name()
	if _, err := result.WriteTo(file); err != nil {
		_ = file.Close()
		return FileResult{}, fmt.Errorf("write renderer output file: %w", err)
	}
	if err := file.Close(); err != nil {
		return FileResult{}, fmt.Errorf("close renderer output file: %w", err)
	}
	return FileResult{path: path, fileName: result.fileName}, nil
}

func (r FileResult) Path() string {
	return r.path
}

func (r FileResult) FileName() (string, bool) {
	return r.fileName.value, r.fileName.set
}
