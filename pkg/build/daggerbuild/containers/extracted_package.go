package containers

import "dagger.io/dagger"

// ExtractedActive returns a directory that holds an extracted tar.gz
func ExtractedArchive(d *dagger.Client, f *dagger.File) *dagger.Directory {
	return d.Container().From("busybox").
		// Workaround for now (maybe unnecessary?): set a FILE environment variable so that we don't accidentally cache
		WithFile("/src/archive.tar.gz", f).
		WithExec([]string{"mkdir", "-p", "/src/archive"}).
		WithExec([]string{"tar", "--strip-components=1", "-xzf", "/src/archive.tar.gz", "-C", "/src/archive"}).
		Directory("/src/archive")
}
