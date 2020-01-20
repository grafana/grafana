package main

import (
	"flag"
	"fmt"
	"log"
	"os"
)

func main() {
	var version string
	var whatsNewURL string
	var releaseNotesURL string
	var dryRun bool
	var enterprise bool
	var nightly bool
	var apiKey string

	flag.StringVar(&version, "version", "", "Grafana version (ex: --version v5.2.0-beta1)")
	flag.StringVar(&whatsNewURL, "wn", "", "What's new url (ex: --wn http://docs.grafana.org/guides/whats-new-in-v5-2/)")
	flag.StringVar(&releaseNotesURL, "rn", "", "Grafana version (ex: --rn https://community.grafana.com/t/release-notes-v5-2-x/7894)")
	flag.StringVar(&apiKey, "apikey", "", "Grafana.com API key (ex: --apikey ABCDEF)")
	flag.BoolVar(&dryRun, "dry-run", false, "--dry-run")
	flag.BoolVar(&enterprise, "enterprise", false, "--enterprise")
	flag.BoolVar(&nightly, "nightly", false, "--nightly (default: false)")
	flag.Parse()

	if len(os.Args) == 1 {
		fmt.Println("Usage: go run publisher.go main.go --version <v> --wn <what's new url> --rn <release notes url> --apikey <api key> --dry-run false --enterprise false --nightly false")
		fmt.Println("example: go run publisher.go main.go --version v5.2.0-beta2 --wn http://docs.grafana.org/guides/whats-new-in-v5-2/ --rn https://community.grafana.com/t/release-notes-v5-2-x/7894 --apikey ASDF123 --dry-run --enterprise")
		os.Exit(1)
	}

	if dryRun {
		log.Println("Dry-run has been enabled.")
	}
	var baseURL string
	var builder releaseBuilder
	var product string

	archiveProviderRoot := "https://dl.grafana.com"
	buildArtifacts := completeBuildArtifactConfigurations

	if enterprise {
		product = "grafana-enterprise"
		baseURL = createBaseURL(archiveProviderRoot, "enterprise", product, nightly)

	} else {
		product = "grafana"
		baseURL = createBaseURL(archiveProviderRoot, "oss", product, nightly)
	}

	builder = releaseFromExternalContent{
		getter:                 getHTTPContents{},
		rawVersion:             version,
		artifactConfigurations: buildArtifacts,
	}

	p := publisher{
		apiKey:         apiKey,
		apiURI:         "https://grafana.com/api",
		product:        product,
		dryRun:         dryRun,
		enterprise:     enterprise,
		baseArchiveURL: baseURL,
		builder:        builder,
	}
	if err := p.doRelease(whatsNewURL, releaseNotesURL, nightly); err != nil {
		log.Fatalf("error: %v", err)
	}
}
func createBaseURL(root string, bucketName string, product string, nightly bool) string {
	var subPath string
	if nightly {
		subPath = "master"
	} else {
		subPath = "release"
	}

	return fmt.Sprintf("%s/%s/%s/%s", root, bucketName, subPath, product)
}
