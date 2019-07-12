package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"strings"
	"time"
)

type publisher struct {
	apiKey         string
	apiURI         string
	product        string
	dryRun         bool
	enterprise     bool
	baseArchiveURL string
	builder        releaseBuilder
}

type releaseBuilder interface {
	prepareRelease(baseArchiveURL, whatsNewURL string, releaseNotesURL string, nightly bool) (*release, error)
}

func (p *publisher) doRelease(whatsNewURL string, releaseNotesURL string, nightly bool) error {
	currentRelease, err := p.builder.prepareRelease(p.baseArchiveURL, whatsNewURL, releaseNotesURL, nightly)
	if err != nil {
		return err
	}

	if err := p.postRelease(currentRelease); err != nil {
		return err
	}

	return nil
}

func (p *publisher) postRelease(r *release) error {
	err := p.postRequest("/versions", r, fmt.Sprintf("Create Release %s", r.Version))
	if err != nil {
		return err
	}
	err = p.postRequest("/versions/"+r.Version, r, fmt.Sprintf("Update Release %s", r.Version))
	if err != nil {
		return err
	}
	for _, b := range r.Builds {
		err = p.postRequest(fmt.Sprintf("/versions/%s/packages", r.Version), b, fmt.Sprintf("Create Build %s %s", b.Os, b.Arch))
		if err != nil {
			return err
		}
		err = p.postRequest(fmt.Sprintf("/versions/%s/packages/%s/%s", r.Version, b.Arch, b.Os), b, fmt.Sprintf("Update Build %s %s", b.Os, b.Arch))
		if err != nil {
			return err
		}
	}

	return nil
}

type releaseType int

const (
	// STABLE is a release type constant
	STABLE releaseType = iota + 1
	// BETA is a release type constant
	BETA
	// NIGHTLY is a release type constant
	NIGHTLY
)

func (rt releaseType) beta() bool {
	return rt == BETA
}

func (rt releaseType) stable() bool {
	return rt == STABLE
}

func (rt releaseType) nightly() bool {
	return rt == NIGHTLY
}

type buildArtifact struct {
	os             string
	arch           string
	urlPostfix     string
	packagePostfix string
}

func (t buildArtifact) getURL(baseArchiveURL, version string, releaseType releaseType) string {
	prefix := "-"
	rhelReleaseExtra := ""

	if t.os == "deb" {
		prefix = "_"
	}

	if releaseType.stable() && t.os == "rhel" {
		rhelReleaseExtra = "-1"
	}

	url := strings.Join([]string{baseArchiveURL, t.packagePostfix, prefix, version, rhelReleaseExtra, t.urlPostfix}, "")
	return url
}

var completeBuildArtifactConfigurations = []buildArtifact{
	{
		os:         "deb",
		arch:       "arm64",
		urlPostfix: "_arm64.deb",
	},
	{
		os:         "rhel",
		arch:       "arm64",
		urlPostfix: ".aarch64.rpm",
	},
	{
		os:         "linux",
		arch:       "arm64",
		urlPostfix: ".linux-arm64.tar.gz",
	},
	{
		os:         "deb",
		arch:       "armv7",
		urlPostfix: "_armhf.deb",
	},
	{
		os:             "deb",
		arch:           "armv6",
		packagePostfix: "-rpi",
		urlPostfix:     "_armhf.deb",
	},
	{
		os:         "rhel",
		arch:       "armv7",
		urlPostfix: ".armhfp.rpm",
	},
	{
		os:         "linux",
		arch:       "armv6",
		urlPostfix: ".linux-armv6.tar.gz",
	},
	{
		os:         "linux",
		arch:       "armv7",
		urlPostfix: ".linux-armv7.tar.gz",
	},
	{
		os:         "darwin",
		arch:       "amd64",
		urlPostfix: ".darwin-amd64.tar.gz",
	},
	{
		os:         "deb",
		arch:       "amd64",
		urlPostfix: "_amd64.deb",
	},
	{
		os:         "rhel",
		arch:       "amd64",
		urlPostfix: ".x86_64.rpm",
	},
	{
		os:         "linux",
		arch:       "amd64",
		urlPostfix: ".linux-amd64.tar.gz",
	},
	{
		os:         "win",
		arch:       "amd64",
		urlPostfix: ".windows-amd64.zip",
	},
	{
		os:         "win-installer",
		arch:       "amd64",
		urlPostfix: ".windows-amd64.msi",
	},
}

type artifactFilter struct {
	os   string
	arch string
}

func filterBuildArtifacts(filters []artifactFilter) ([]buildArtifact, error) {
	var artifacts []buildArtifact
	for _, f := range filters {
		matched := false

		for _, a := range completeBuildArtifactConfigurations {
			if f.os == a.os && f.arch == a.arch {
				artifacts = append(artifacts, a)
				matched = true
				break
			}
		}

		if !matched {
			return nil, fmt.Errorf("No buildArtifact for os=%v, arch=%v", f.os, f.arch)
		}
	}
	return artifacts, nil
}

func newBuild(baseArchiveURL string, ba buildArtifact, version string, rt releaseType, sha256 string) build {
	return build{
		Os:     ba.os,
		URL:    ba.getURL(baseArchiveURL, version, rt),
		Sha256: sha256,
		Arch:   ba.arch,
	}
}

func (p *publisher) apiURL(url string) string {
	return fmt.Sprintf("%s/%s%s", p.apiURI, p.product, url)
}

func (p *publisher) postRequest(url string, obj interface{}, desc string) error {
	jsonBytes, err := json.Marshal(obj)
	if err != nil {
		return err
	}

	if p.dryRun {
		log.Println(fmt.Sprintf("POST to %s:", p.apiURL(url)))
		log.Println(string(jsonBytes))
		return nil
	}

	req, err := http.NewRequest(http.MethodPost, p.apiURL(url), bytes.NewReader(jsonBytes))
	if err != nil {
		return err
	}
	req.Header.Add("Authorization", "Bearer "+p.apiKey)
	req.Header.Add("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}

	if res.StatusCode == http.StatusOK {
		log.Printf("Action: %s \t OK", desc)
		return nil
	}

	if res.Body != nil {
		defer res.Body.Close()
		body, err := ioutil.ReadAll(res.Body)
		if err != nil {
			return err
		}

		if strings.Contains(string(body), "already exists") || strings.Contains(string(body), "Nothing to update") {
			log.Printf("Action: %s \t Already exists", desc)
		} else {
			log.Printf("Action: %s \t Failed - Status: %v", desc, res.Status)
			log.Printf("Resp: %s", body)
			log.Fatalf("Quiting")
		}
	}

	return nil
}

type release struct {
	Version         string    `json:"version"`
	ReleaseDate     time.Time `json:"releaseDate"`
	Stable          bool      `json:"stable"`
	Beta            bool      `json:"beta"`
	Nightly         bool      `json:"nightly"`
	WhatsNewURL     string    `json:"whatsNewUrl"`
	ReleaseNotesURL string    `json:"releaseNotesUrl"`
	Builds          []build   `json:"-"`
}

type build struct {
	Os     string `json:"os"`
	URL    string `json:"url"`
	Sha256 string `json:"sha256"`
	Arch   string `json:"arch"`
}
