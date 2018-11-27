package main

import (
	"flag"
	"fmt"
	"log"
	"os"
)

func main() {
	var version string
	var whatsNewUrl string
	var releaseNotesUrl string
	var dryRun bool
	var enterprise bool
	var fromLocal bool
	var nightly bool
	var apiKey string

	flag.StringVar(&version, "version", "", "Grafana version (ex: --version v5.2.0-beta1)")
	flag.StringVar(&whatsNewUrl, "wn", "", "What's new url (ex: --wn http://docs.grafana.org/guides/whats-new-in-v5-2/)")
	flag.StringVar(&releaseNotesUrl, "rn", "", "Grafana version (ex: --rn https://community.grafana.com/t/release-notes-v5-2-x/7894)")
	flag.StringVar(&apiKey, "apikey", "", "Grafana.com API key (ex: --apikey ABCDEF)")
	flag.BoolVar(&dryRun, "dry-run", false, "--dry-run")
	flag.BoolVar(&enterprise, "enterprise", false, "--enterprise")
	flag.BoolVar(&fromLocal, "from-local", false, "--from-local (builds will be tagged as nightly)")
	flag.Parse()

	nightly = fromLocal

	if len(os.Args) == 1 {
		fmt.Println("Usage: go run publisher.go main.go --version <v> --wn <what's new url> --rn <release notes url> --apikey <api key> --dry-run false --enterprise false --nightly false")
		fmt.Println("example: go run publisher.go main.go --version v5.2.0-beta2 --wn http://docs.grafana.org/guides/whats-new-in-v5-2/ --rn https://community.grafana.com/t/release-notes-v5-2-x/7894 --apikey ASDF123 --dry-run --enterprise")
		os.Exit(1)
	}

	if dryRun {
		log.Println("Dry-run has been enabled.")
	}
	var baseUrl string
	var builder releaseBuilder
	var product string

	archiveProviderRoot := "https://dl.grafana.com"
	buildArtifacts := completeBuildArtifactConfigurations

	if enterprise {
		product = "grafana-enterprise"
		baseUrl = createBaseUrl(archiveProviderRoot, "enterprise", product, nightly)
		var err error
		buildArtifacts, err = filterBuildArtifacts([]artifactFilter{
			{os: "deb", arch: "amd64"},
			{os: "rhel", arch: "amd64"},
			{os: "linux", arch: "amd64"},
			{os: "win", arch: "amd64"},
		})

		if err != nil {
			log.Fatalf("Could not filter to the selected build artifacts, err=%v", err)
		}

	} else {
		product = "grafana"
		baseUrl = createBaseUrl(archiveProviderRoot, "oss", product, nightly)
	}

	if fromLocal {
		path, _ := os.Getwd()
		builder = releaseLocalSources{
			path:                   path,
			artifactConfigurations: buildArtifacts,
		}
	} else {
		builder = releaseFromExternalContent{
			getter:                 getHttpContents{},
			rawVersion:             version,
			artifactConfigurations: buildArtifacts,
		}
	}

	p := publisher{
		apiKey:         apiKey,
		apiUri:         "https://grafana.com/api",
		product:        product,
		dryRun:         dryRun,
		enterprise:     enterprise,
		baseArchiveUrl: baseUrl,
		builder:        builder,
	}
	if err := p.doRelease(whatsNewUrl, releaseNotesUrl, nightly); err != nil {
		log.Fatalf("error: %v", err)
	}
}
func createBaseUrl(root string, bucketName string, product string, nightly bool) string {
	var subPath string
	if nightly {
		subPath = "master"
	} else {
		subPath = "release"
	}

	return fmt.Sprintf("%s/%s/%s/%s", root, bucketName, subPath, product)
}
