//go:build mage
// +build mage

package main

import (
	"fmt"
	// mage:import
	"github.com/magefile/mage/sh"

	// mage:import
	build "github.com/grafana/grafana-plugin-sdk-go/build"
)

func Hello() {
	fmt.Println("Welcome to mage!")
}

// Compiles protobuf definitions as defined in .pkg/proto to go-code
func Protoc() error {
	//protoc --go_out=. --go_opt=paths=source_relative \
	//	   --go-grpc_out=. --go-grpc_opt=paths=source_relative \
	//	   pkg/proto/DataManager.proto
	return sh.RunV("protoc", "--go_out=.", "--go_opt=paths=source_relative", "--go-grpc_out=.", "--go-grpc_opt=paths=source_relative", "pkg/proto/v2/apiv2.proto")
}

// Default configures the default target.
var Default = build.BuildAll
