package main

import "github.com/grafana/scribe"

const (
	BuildImage       = "grafana/build-container:1.5.7"
	PublishImage     = "grafana/grafana-ci-deploy:1.3.1"
	DocsWebsiteImage = "grafana/docs-base:latest"
)

func BuildDocumentation(sc *scribe.Scribe) {
	sc.Run(
		StepDownloadGrabplToBin().WithName("download grabpl"),
		StepYarnInstall().WithName("yarn install"),
	)

	sc.Parallel(
		StepCodespell().WithName("codespell"),
		StepLintDocumentation().WithName("lint docs"),
	)

	sc.Run(
		StepPackageFrontend().WithName("build frontend package"),
		StepBuildFrontendDocs().WithName("build frontend documentation"),
		StepBuildDocsWebsite().WithName("build documentation website"),
	)
}

func main() {
	multi := scribe.NewMulti()
	defer multi.Done()

	multi.Parallel(
		multi.New("build documentation website", BuildDocumentation),
	)
}
