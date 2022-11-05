package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"syscall"
)

func main() {
	curr, err := os.Executable()
	if err != nil {
		fmt.Println("Error locating executable:", err)
		os.Exit(1)
	}

	executable := "grafana-server"
	if runtime.GOOS == "windows" {
		executable += ".exe"
	}

	binary := filepath.Join(filepath.Dir(filepath.Clean(curr)), executable)
	if _, err := os.Stat(binary); err != nil {
		binary, err = exec.LookPath(executable)
		if err != nil {
			fmt.Printf("Error locating %s: %s\n", executable, err)
		}
	}

	args := append([]string{"grafana-cli"}, os.Args[1:]...)

	execErr := syscall.Exec(binary, args, os.Environ())
	if execErr != nil {
		fmt.Printf("Error running %s: %s\n", binary, execErr)
		os.Exit(1)
	}
}
