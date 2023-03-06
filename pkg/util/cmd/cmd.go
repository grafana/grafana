package cmd

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"syscall"
)

func RunGrafanaCmd(subCmd string) int {
	curr, err := os.Executable()
	if err != nil {
		fmt.Println("Error locating executable:", err)
		return 1
	}

	executable := "grafana"
	if runtime.GOOS == "windows" {
		executable += ".exe"
	}

	binary := filepath.Join(filepath.Dir(filepath.Clean(curr)), executable)
	if _, err := os.Stat(binary); err != nil {
		binary, err = exec.LookPath(executable)
		if err != nil {
			fmt.Printf("Error locating %s: %s\n", executable, err)
			return 1
		}
	}

	// windows doesn't support syscall.Exec so we just run the main binary as a command
	if runtime.GOOS == "windows" {
		// bypassing gosec G204 because we need to build the command programmatically
		// nolint:gosec
		cmd := exec.Command(binary, append([]string{subCmd}, os.Args[1:]...)...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Stdin = os.Stdin
		cmd.Env = os.Environ()
		err := cmd.Run()
		if err == nil {
			return 0
		}
		var exitError *exec.ExitError
		if errors.As(err, &exitError) {
			return exitError.ExitCode()
		}
		return 1
	}

	args := append([]string{"grafana", subCmd}, os.Args[1:]...)

	// bypassing gosec G204 because we need to build the command programmatically
	// nolint:gosec
	execErr := syscall.Exec(binary, args, os.Environ())
	if execErr != nil {
		fmt.Printf("Error running %s: %s\n", binary, execErr)
		return 1
	}

	return 0
}
