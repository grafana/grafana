package targz

import (
	"path"

	"dagger.io/dagger"
)

func NewMappedDir(path string, directory *dagger.Directory) MappedDirectory {
	return MappedDirectory{path: path, directory: directory}
}

type MappedDirectory struct {
	path      string
	directory *dagger.Directory
}

type MappedFile struct {
	path string
	file *dagger.File
}

func NewMappedFile(path string, file *dagger.File) MappedFile {
	return MappedFile{path: path, file: file}
}

type Opts struct {
	// Root is the root folder that holds all of the packaged data.
	// It is common for targz packages to have a root folder.
	// This should equal something like `grafana-9.4.1`.
	Root string

	// A map of directory paths relative to the root, like 'bin', 'public', 'npm-artifacts'
	// to dagger directories.
	Directories []MappedDirectory
	Files       []MappedFile
}

func Build(packager *dagger.Container, opts *Opts) *dagger.File {
	root := opts.Root

	packager = packager.
		WithWorkdir("/src")

	paths := []string{}
	for _, v := range opts.Files {
		path := path.Join(root, v.path)
		packager = packager.WithMountedFile(path, v.file)
		paths = append(paths, path)
	}

	for _, v := range opts.Directories {
		path := path.Join(root, v.path)
		packager = packager.WithMountedDirectory(path, v.directory)
		paths = append(paths, path)
	}

	packager = packager.WithExec(append([]string{"tar", "-czf", "/package.tar.gz"}, paths...))

	return packager.File("/package.tar.gz")
}
