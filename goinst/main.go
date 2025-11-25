package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"time"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: toolexec <tool> [args...]")
		os.Exit(1)
	}

	tool := os.Args[1]
	args := os.Args[2:]

	start := time.Now()

	cmd := exec.Command(tool, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	err := cmd.Run()
	elapsed := time.Since(start)
	log.Println("======================")
	log.Printf("%v", args)
	log.Println("")
	log.Printf("   tool: %s", tool)
	log.Printf("   package: %s", args[len(args)-1])
	log.Printf("   args: %v", args)
	log.Printf("   elapsed: %s", elapsed)
	log.Println("======================")
	log.Println("")

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			os.Exit(exitErr.ExitCode())
		} else {
			fmt.Fprintln(os.Stderr, "Error:", err)
			os.Exit(1)
		}
	}
}
