package main

import (
	"fmt"
	"io/ioutil"
	"os"

	"github.com/fatih/color"
	"github.com/mgechev/revive/lint"
)

var logo = color.YellowString(` _ __ _____   _(_)__  _____
| '__/ _ \ \ / / \ \ / / _ \
| | |  __/\ V /| |\ V /  __/
|_|  \___| \_/ |_| \_/ \___|`)

var call = color.MagentaString("revive -config c.toml -formatter friendly -exclude a.go -exclude b.go ./...")

var banner = fmt.Sprintf(`
%s

Example:
  %s
`, logo, call)

func main() {
	config := getConfig()
	formatter := getFormatter()
	packages := getPackages()

	revive := lint.New(func(file string) ([]byte, error) {
		return ioutil.ReadFile(file)
	})

	lintingRules := getLintingRules(config)

	failures, err := revive.Lint(packages, lintingRules, *config)
	if err != nil {
		fail(err.Error())
	}

	formatChan := make(chan lint.Failure)
	exitChan := make(chan bool)

	var output string
	go (func() {
		output, err = formatter.Format(formatChan, *config)
		if err != nil {
			fail(err.Error())
		}
		exitChan <- true
	})()

	exitCode := 0
	for f := range failures {
		if f.Confidence < config.Confidence {
			continue
		}
		if exitCode == 0 {
			exitCode = config.WarningCode
		}
		if c, ok := config.Rules[f.RuleName]; ok && c.Severity == lint.SeverityError {
			exitCode = config.ErrorCode
		}
		if c, ok := config.Directives[f.RuleName]; ok && c.Severity == lint.SeverityError {
			exitCode = config.ErrorCode
		}

		formatChan <- f
	}

	close(formatChan)
	<-exitChan
	if output != "" {
		fmt.Println(output)
	}

	os.Exit(exitCode)
}
