//go:build enterprise || pro
// +build enterprise pro

package main

import "github.com/grafana/grafana/pkg/build/cmd/extensions"

func init() {
	registerAppCommand(extensions.CreateArtifactsPageCmd)
	registerAppCommand(extensions.ExportVersionCommand)
}
