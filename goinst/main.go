package main

import (
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

var logger *log.Logger

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: toolexec <tool> [args...]")
		os.Exit(1)
	}

	f, err := os.OpenFile("toolexec.log", os.O_RDWR|os.O_CREATE|os.O_APPEND, 0666)
	if err != nil {
		log.Fatalf("error opening file: %v", err)
	}
	defer f.Close()

	logger = log.New(f, "", log.LstdFlags)

	start := time.Now()

	cmd := exec.Command(os.Args[1], os.Args[2:]...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	err = cmd.Run()
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
			logger.Fatal("Error:", err)
		}
	}
}

func printAsm(elapsed interface{}) {
	logger.Println("==========Asm=========")
	logger.Printf("   tool: %s", Asm)
	logger.Printf("   package: %s", os.Args[len(os.Args)-1])
	logger.Printf("   elapsed: %s", elapsed)
	logger.Println("======================")
	logger.Println("")
}

func printCompile(elapsed interface{}) {
	logger.Println("========Compile=======")
	logger.Printf("   tool: %s", Compile)
	logger.Printf("   package: %s", getPackage(os.Args))
	logger.Printf("   elapsed: %s", elapsed)
	logger.Println("======================")
	logger.Println("")
}

func printLink(elapsed interface{}) {
	logger.Println("========LINK========")
	logger.Printf("   tool: %s", Link)
	logger.Printf("   package: %s", os.Args[len(os.Args)-1])
	logger.Printf("   elapsed: %s", elapsed)
	logger.Println("======================")
	logger.Println("")
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
