package hack

// this ensures that code-generator is available in the go.mod file,
// which is a dependency of the ./update-codegen.sh script.
import (
	_ "k8s.io/code-generator/cmd/client-gen/generators"
)
