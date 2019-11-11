// +build tools

package main

import (
	_ "github.com/golangci/golangci-lint/cmd/golangci-lint"
	_ "github.com/mgechev/revive"
	_ "github.com/securego/gosec"
	_ "github.com/unknwon/bra"
)
