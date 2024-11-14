//+build mage

package main

import (
	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"
)

const imageName = "grafana/ci-wix:0.1.1"

// Build builds the Docker image.
func Build() error {
	if err := sh.RunV("docker", "build", "-t", imageName, "."); err != nil {
		return err
	}

	return nil
}

// Publish publishes the Docker image.
func Publish() error {
	mg.Deps(Build)
	return sh.RunV("docker", "push", imageName)
}

var Default = Build
