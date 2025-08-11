package containers

import (
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"

	"dagger.io/dagger"
)

const GoogleCloudImage = "google/cloud-sdk:alpine"

// GCPAuthenticator injects authentication information into the provided container.
type GCPAuthenticator interface {
	Authenticate(*dagger.Client, *dagger.Container) (*dagger.Container, error)
}

// GCPServiceAccount satisfies GCPAuthenticator and injects the provided ServiceAccount into the filesystem and adds a 'gcloud auth activate-service-account'
type GCPServiceAccount struct {
	DaggerFile *dagger.File
	JSONFile   string
}

func (a *GCPServiceAccount) Authenticate(d *dagger.Client, c *dagger.Container) (*dagger.Container, error) {
	if a.DaggerFile == nil && a.JSONFile == "" {
		return nil, fmt.Errorf("GCPServiceAccount authentication missed JSONFile AND DaggerFile")
	}
	var container *dagger.Container

	if a.JSONFile != "" {
		container = c.WithMountedFile(
			"/opt/service_account.json",
			d.Host().Directory(filepath.Dir(a.JSONFile)).File(filepath.Base(a.JSONFile)),
		)
	}

	if a.DaggerFile != nil {
		container = c.WithMountedFile("/opt/service_account.json", a.DaggerFile)
	}

	return container.WithExec([]string{"gcloud", "auth", "activate-service-account", "--key-file", "/opt/service_account.json"}), nil
}

func NewGCPServiceAccount(filepath string) *GCPServiceAccount {
	return &GCPServiceAccount{
		JSONFile: filepath,
	}
}

func NewGCPServiceAccountWithFile(file *dagger.File) *GCPServiceAccount {
	return &GCPServiceAccount{
		DaggerFile: file,
	}
}

// InheritedServiceAccount uses `gcloud` command in the current shell to get the GCS credentials.
// This type should really only be used when running locally.
type GCPInheritedAuth struct{}

func (a *GCPInheritedAuth) Authenticate(d *dagger.Client, c *dagger.Container) (*dagger.Container, error) {
	if val, ok := os.LookupEnv("GOOGLE_APPLICATION_CREDENTIALS"); ok {
		return c.WithMountedDirectory("/auth/credentials.json", d.Host().Directory(val)).WithEnvVariable("GOOGLE_APPLICATION_CREDENTIALS", "/auth/credentials.json"), nil
	}

	cfg, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	return c.WithMountedDirectory("/root/.config/gcloud", d.Host().Directory(filepath.Join(cfg, ".config", "gcloud"))), nil
}

func GCSUploadDirectory(d *dagger.Client, image string, auth GCPAuthenticator, dir *dagger.Directory, dst string) (*dagger.Container, error) {
	container := d.Container().From(image).
		WithMountedDirectory("/src", dir)

	var err error
	container, err = auth.Authenticate(d, container)
	if err != nil {
		return nil, err
	}

	secret := d.SetSecret("gcs-destination", dst)
	container = container.WithSecretVariable("GCS_DESTINATION", secret)

	return container.WithExec([]string{"/bin/sh", "-c", "gcloud storage cp -r /src/* ${GCS_DESTINATION}"}), nil
}

func GCSDownloadFile(d *dagger.Client, image string, auth GCPAuthenticator, url string) (*dagger.File, error) {
	var (
		container = d.Container().From(image)
		err       error
		r         = rand.Int()
	)

	container, err = auth.Authenticate(d, container)
	if err != nil {
		return nil, err
	}
	secret := d.SetSecret("gcs-download-url", url)
	file := container.
		WithEnvVariable("RAND", strconv.Itoa(r)).
		WithSecretVariable("GCS_DOWNLOAD_URL", secret).
		WithExec([]string{"/bin/sh", "-c", "gcloud storage cp ${GCS_DOWNLOAD_URL} /src/file"}).
		File("/src/file")

	return file, nil
}

func GCSAuth(d *dagger.Client, opts *GCPOpts) GCPAuthenticator {
	var auth GCPAuthenticator = &GCPInheritedAuth{}
	// The order of operations:
	// 1. Try to use base64 key.
	// 2. Try to use gcp-service-account-key (path to a file).
	// 3. Try mounting $XDG_CONFIG_HOME/gcloud
	if key := opts.ServiceAccountKeyBase64; key != "" {
		secret := d.SetSecret("gcp-sa-key-base64", key)
		// Write key to a file in an alpine container...
		file := d.Container().From("alpine").
			WithSecretVariable("GCP_SERVICE_ACCOUNT_KEY_BASE64", secret).
			WithExec([]string{"/bin/sh", "-c", "echo $GCP_SERVICE_ACCOUNT_KEY_BASE64 | base64 -d > /key.json"}).
			File("/key.json")

		auth = NewGCPServiceAccountWithFile(file)
	} else if key := opts.ServiceAccountKey; key != "" {
		auth = NewGCPServiceAccount(key)
	}

	return auth
}
