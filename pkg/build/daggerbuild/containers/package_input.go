package containers

import (
	"context"
	"fmt"
	"net/url"
	"path/filepath"
	"strings"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/cliutil"
)

type PackageInputOpts struct {
	// Name is used when overriding the artifact that is being produced. This is used in very specific scenarios where
	// the source package's name does not match the package's metadata name.
	Name     string
	Packages []string
}

func PackageInputOptsFromFlags(c cliutil.CLIContext) *PackageInputOpts {
	return &PackageInputOpts{
		Name:     c.String("name"),
		Packages: c.StringSlice("package"),
	}
}

// GetPackage uses the PackageInputOpts to get a Grafana package, either from the local filesystem (if the package is of type 'file://...')
// or Google Cloud Storage if the package is a 'gs://' URL.
func GetPackages(ctx context.Context, d *dagger.Client, packageOpts *PackageInputOpts, gcpOpts *GCPOpts) ([]*dagger.File, error) {
	files := make([]*dagger.File, len(packageOpts.Packages))
	for i, pkg := range packageOpts.Packages {
		u, err := url.Parse(pkg)
		if err != nil {
			return nil, err
		}

		var file *dagger.File
		switch u.Scheme {
		case "file", "fs":
			p := strings.TrimPrefix(u.String(), u.Scheme+"://")
			f, err := getLocalPackage(ctx, d, p)
			if err != nil {
				return nil, err
			}

			file = f
		case "gs":
			f, err := getGCSPackage(ctx, d, gcpOpts, u.String())
			if err != nil {
				return nil, err
			}

			file = f
		default:
			return nil, fmt.Errorf("%w: %s", ErrorUnrecognizedScheme, u.Scheme)
		}

		files[i] = file
	}

	return files, nil
}

func getLocalPackage(ctx context.Context, d *dagger.Client, file string) (*dagger.File, error) {
	// pending https://github.com/dagger/dagger/issues/4745
	return d.Host().Directory(filepath.Dir(file)).File(filepath.Base(file)), nil
}

func getGCSPackage(ctx context.Context, d *dagger.Client, opts *GCPOpts, gcsURL string) (*dagger.File, error) {
	auth := GCSAuth(d, opts)
	return GCSDownloadFile(d, GoogleCloudImage, auth, gcsURL)
}
