package docker

import (
	"fmt"
	"log"
	"os"
	"os/exec"
)

// AllArchs is a list of all supported Docker image architectures.
var AllArchs = []string{"amd64", "armv7", "arm64"}

// Init initializes the OS for Docker image building.
func Init() error {
	// Necessary for cross-platform builds
	if err := os.Setenv("DOCKER_BUILDKIT", "1"); err != nil {
		log.Println("error setting DOCKER_BUILDKIT environment variable:", err)
	}

	// Enable execution of Docker images for other architectures
	cmd := exec.Command("docker", "run", "--privileged", "--rm",
		"docker/binfmt:a7996909642ee92942dcd6cff44b9b95f08dad64")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to enable execution of cross-platform Docker images: %w\n%s", err, output)
	}
	return nil
}
