package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
)

func main() {
	e, err := os.Executable()
	if err != nil {
		fmt.Println("Error locating executable:", err)
		os.Exit(1)
	}

	executable := "grafana-server"
	if runtime.GOOS == "windows" {
		executable += ".exe"
	}

	binary := filepath.Join(filepath.Dir(filepath.Clean(e)), executable)

	args := append([]string{"grafana-cli"}, os.Args[1:]...)

	execErr := syscall.Exec(binary, args, os.Environ())
	if execErr != nil {
		fmt.Printf("Error running %s: %s\n", binary, execErr)
		os.Exit(1)
	}
}
