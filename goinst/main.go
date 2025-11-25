package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"
)

var (
	Asm     = "asm"
	Compile = "compile"
	Link    = "link"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: toolexec <tool> [args...]")
		os.Exit(1)
	}

	start := time.Now()

	cmd := exec.Command(os.Args[1], os.Args[2:]...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	err := cmd.Run()
	elapsed := time.Since(start)

	switch getTool(os.Args[1]) {
	case Asm:
		printAsm(elapsed)
	case Compile:
		printCompile(elapsed)
	case Link:
		printLink(elapsed)
	}

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			os.Exit(exitErr.ExitCode())
		} else {
			fmt.Fprintln(os.Stderr, "Error:", err)
			os.Exit(1)
		}
	}
}

func printAsm(elapsed interface{}) {
	log.Println("==========Asm=========")
	log.Printf("   tool: %s", Asm)
	log.Printf("   package: %s", os.Args[len(os.Args)-1])
	log.Printf("   elapsed: %s", elapsed)
	log.Println("======================")
	log.Println("")
}

func printCompile(elapsed interface{}) {
	log.Println("========Compile=======")
	log.Printf("   tool: %s", Compile)
	log.Printf("   package: %s", getPackage(os.Args))
	log.Printf("   elapsed: %s", elapsed)
	log.Println("======================")
	log.Println("")
}

func printLink(elapsed interface{}) {
	log.Println("========LINK========")
	log.Printf("   tool: %s", Link)
	log.Printf("   package: %s", os.Args[len(os.Args)-1])
	log.Printf("   elapsed: %s", elapsed)
	log.Println("======================")
	log.Println("")
}

func getTool(tool string) string {
	parts := strings.Split(tool, "/")
	return parts[len(parts)-1]
}

func getPackage(args []string) string {
	for i, v := range args {
		if i+1 == len(args) {
			break
		}

		if v == "-p" {
			return args[i+1]
		}
	}

	return "unknown"
}
