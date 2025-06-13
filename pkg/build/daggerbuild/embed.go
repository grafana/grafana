package grafanabuild

import (
	"embed"
)

//go:embed scripts/packaging/windows/*
var WindowsPackaging embed.FS
