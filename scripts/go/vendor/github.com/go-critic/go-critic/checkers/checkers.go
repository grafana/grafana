// Package checkers is a gocritic linter main checkers collection.
package checkers

import (
	"github.com/go-lintpack/lintpack"
)

var collection = &lintpack.CheckerCollection{
	URL: "https://github.com/go-critic/go-critic/checkers",
}
