package gcom

import (
	"context"
	"encoding/json"
	"fmt"

	"dagger.io/dagger"
)

type GCOMVersionPayload struct {
	Version         string `json:"version"`
	ReleaseDate     string `json:"releaseDate"`
	Stable          bool   `json:"stable"`
	Beta            bool   `json:"beta"`
	Nightly         bool   `json:"nightly"`
	WhatsNewURL     string `json:"whatsNewUrl"`
	ReleaseNotesURL string `json:"releaseNotesUrl"`
}

type GCOMPackagePayload struct {
	OS     string `json:"os"`
	URL    string `json:"url"`
	Sha256 string `json:"sha256"`
	Arch   string `json:"arch"`
}

// PublishGCOMVersion publishes a version to grafana.com.
func PublishGCOMVersion(ctx context.Context, d *dagger.Client, versionPayload *GCOMVersionPayload, opts *GCOMOpts) (string, error) {
	versionApiUrl := opts.URL.JoinPath("/versions")

	jsonVersionPayload, err := json.Marshal(versionPayload)
	if err != nil {
		return "", err
	}

	apiKeySecret := d.SetSecret("gcom-api-key", opts.ApiKey)

	return d.Container().From("alpine/curl").
		WithSecretVariable("GCOM_API_KEY", apiKeySecret).
		WithExec([]string{"/bin/sh", "-c", fmt.Sprintf(`curl -H "Content-Type: application/json" -H "Authorization: Bearer $GCOM_API_KEY" -d '%s' %s`, string(jsonVersionPayload), versionApiUrl.String())}).
		Stdout(ctx)
}

// PublishGCOMPackage publishes a package to grafana.com.
func PublishGCOMPackage(ctx context.Context, d *dagger.Client, packagePayload *GCOMPackagePayload, opts *GCOMOpts, version string) (string, error) {
	packagesApiUrl := opts.URL.JoinPath("/versions/", version, "/packages")

	jsonPackagePayload, err := json.Marshal(packagePayload)
	if err != nil {
		return "", err
	}

	apiKeySecret := d.SetSecret("gcom-api-key", opts.ApiKey)

	return d.Container().From("alpine/curl").
		WithSecretVariable("GCOM_API_KEY", apiKeySecret).
		WithExec([]string{"/bin/sh", "-c", fmt.Sprintf(`curl -H "Content-Type: application/json" -H "Authorization: Bearer $GCOM_API_KEY" -d '%s' %s`, string(jsonPackagePayload), packagesApiUrl.String())}).
		Stdout(ctx)
}
