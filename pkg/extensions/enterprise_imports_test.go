// This file exists for test dependencies that are not used in OSS and only Enterprise.
// To avoid a blank import of them in "enterprise_imports.go", which causes the dependency to be included in the final binary.
package extensions_test

import (
	"github.com/docker/go-connections/nat"
	"github.com/testcontainers/testcontainers-go"
	"sigs.k8s.io/randfill"
)

// Just use something from the package
var (
	_ testcontainers.Container = nil
	_ nat.Port                 = ""
	_                          = randfill.Filler{}
)
