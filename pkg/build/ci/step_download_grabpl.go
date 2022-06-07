package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/build/ci/starlarkutil"
	"github.com/grafana/scribe/plumbing/pipeline"
	"github.com/grafana/scribe/swfs"
	"github.com/grafana/scribe/swhttp"
)

var (
	ArgumentGrabpl = pipeline.NewFileArgument("grabpl")
)

const grabplURL = "https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/%s/grabpl"

// downloadGrabpl does quite a bit more than it probably should. It reads the repository's file 'scripts/drone/steps/lib.star' for the 'grabpl_version' variable.
// It then downloads grabpl and sets it into the state.
func downloadGrabpl(ctx context.Context, opts pipeline.ActionOpts) error {
	repo := opts.State.MustGetDirectory(pipeline.ArgumentSourceFS)

	vars, err := repo.Open("scripts/drone/steps/lib.star")
	if err != nil {
		return err
	}

	version, err := starlarkutil.Variable(vars, "grabpl_version")
	if err != nil {
		return err
	}

	bin, err := swhttp.Download(ctx, fmt.Sprintf(grabplURL, version))
	if err != nil {
		return err
	}

	return opts.State.SetFileReader(ArgumentGrabpl, bin)
}

func StepDownloadGrabpl() pipeline.Step {
	return pipeline.NewStep(downloadGrabpl).Provides(ArgumentGrabpl).WithArguments(ArgumentGrafanaVersion, pipeline.ArgumentSourceFS)
}

// writeGrabplToBin is a legacy step that writes the downloaded grabpl file into `bin/grabpl`.
func writeGrabplToBin(ctx context.Context, opts pipeline.ActionOpts) error {
	var (
		wd   = opts.State.MustGetString(pipeline.ArgumentWorkingDir)
		path = filepath.Join(wd, "bin", "grabpl")
		bin  = opts.State.MustGetFile(ArgumentGrabpl)
	)

	if err := swfs.CopyFileReader(bin, path); err != nil {
		return err
	}

	return os.Chmod(path, os.FileMode(0755))
}

func StepWriteGrabplToBin() pipeline.Step {
	return pipeline.NewStep(writeGrabplToBin).WithArguments(ArgumentGrafanaVersion)
}

func StepDownloadGrabplToBin() pipeline.Step {
	return pipeline.Combine(StepDownloadGrabpl(), StepWriteGrabplToBin())
}
