package cue

import "embed"

//go:embed */*.cue
var CoreSchema embed.FS
