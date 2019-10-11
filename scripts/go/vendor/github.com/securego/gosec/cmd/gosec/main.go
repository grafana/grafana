// (c) Copyright 2016 Hewlett Packard Enterprise Development LP
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"sort"
	"strings"

	"github.com/securego/gosec"
	"github.com/securego/gosec/output"
	"github.com/securego/gosec/rules"
)

const (
	usageText = `
gosec - Golang security checker

gosec analyzes Go source code to look for common programming mistakes that
can lead to security problems.

VERSION: %s
GIT TAG: %s
BUILD DATE: %s

USAGE:

	# Check a single package
	$ gosec $GOPATH/src/github.com/example/project

	# Check all packages under the current directory and save results in
	# json format.
	$ gosec -fmt=json -out=results.json ./...

	# Run a specific set of rules (by default all rules will be run):
	$ gosec -include=G101,G203,G401  ./...

	# Run all rules except the provided
	$ gosec -exclude=G101 $GOPATH/src/github.com/example/project/...

`
)

type arrayFlags []string

func (a *arrayFlags) String() string {
	return strings.Join(*a, " ")
}

func (a *arrayFlags) Set(value string) error {
	*a = append(*a, value)
	return nil
}

var (
	// #nosec flag
	flagIgnoreNoSec = flag.Bool("nosec", false, "Ignores #nosec comments when set")

	// format output
	flagFormat = flag.String("fmt", "text", "Set output format. Valid options are: json, yaml, csv, junit-xml, html, sonarqube, or text")

	// #nosec alternative tag
	flagAlternativeNoSec = flag.String("nosec-tag", "", "Set an alternative string for #nosec. Some examples: #dontanalyze, #falsepositive")

	// output file
	flagOutput = flag.String("out", "", "Set output file for results")

	// config file
	flagConfig = flag.String("conf", "", "Path to optional config file")

	// quiet
	flagQuiet = flag.Bool("quiet", false, "Only show output when errors are found")

	// rules to explicitly include
	flagRulesInclude = flag.String("include", "", "Comma separated list of rules IDs to include. (see rule list)")

	// rules to explicitly exclude
	flagRulesExclude = flag.String("exclude", "", "Comma separated list of rules IDs to exclude. (see rule list)")

	// log to file or stderr
	flagLogfile = flag.String("log", "", "Log messages to file rather than stderr")

	// sort the issues by severity
	flagSortIssues = flag.Bool("sort", true, "Sort issues by severity")

	// go build tags
	flagBuildTags = flag.String("tags", "", "Comma separated list of build tags")

	// fail by severity
	flagSeverity = flag.String("severity", "low", "Filter out the issues with a lower severity than the given value. Valid options are: low, medium, high")

	// fail by confidence
	flagConfidence = flag.String("confidence", "low", "Filter out the issues with a lower confidence than the given value. Valid options are: low, medium, high")

	// do not fail
	flagNoFail = flag.Bool("no-fail", false, "Do not fail the scanning, even if issues were found")

	// scan tests files
	flagScanTests = flag.Bool("tests", false, "Scan tests files")

	// print version and quit with exit code 0
	flagVersion = flag.Bool("version", false, "Print version and quit with exit code 0")

	// exlude the folders from scan
	flagDirsExclude arrayFlags

	logger *log.Logger
)

// #nosec
func usage() {
	usageText := fmt.Sprintf(usageText, Version, GitTag, BuildDate)
	fmt.Fprintln(os.Stderr, usageText)
	fmt.Fprint(os.Stderr, "OPTIONS:\n\n")
	flag.PrintDefaults()
	fmt.Fprint(os.Stderr, "\n\nRULES:\n\n")

	// sorted rule list for ease of reading
	rl := rules.Generate()
	keys := make([]string, 0, len(rl))
	for key := range rl {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, k := range keys {
		v := rl[k]
		fmt.Fprintf(os.Stderr, "\t%s: %s\n", k, v.Description)
	}
	fmt.Fprint(os.Stderr, "\n")
}

func loadConfig(configFile string) (gosec.Config, error) {
	config := gosec.NewConfig()
	if configFile != "" {
		// #nosec
		file, err := os.Open(configFile)
		if err != nil {
			return nil, err
		}
		defer file.Close()
		if _, err := config.ReadFrom(file); err != nil {
			return nil, err
		}
	}
	if *flagIgnoreNoSec {
		config.SetGlobal(gosec.Nosec, "true")
	}
	if *flagAlternativeNoSec != "" {
		config.SetGlobal(gosec.NoSecAlternative, *flagAlternativeNoSec)
	}
	return config, nil
}

func loadRules(include, exclude string) rules.RuleList {
	var filters []rules.RuleFilter
	if include != "" {
		logger.Printf("Including rules: %s", include)
		including := strings.Split(include, ",")
		filters = append(filters, rules.NewRuleFilter(false, including...))
	} else {
		logger.Println("Including rules: default")
	}

	if exclude != "" {
		logger.Printf("Excluding rules: %s", exclude)
		excluding := strings.Split(exclude, ",")
		filters = append(filters, rules.NewRuleFilter(true, excluding...))
	} else {
		logger.Println("Excluding rules: default")
	}
	return rules.Generate(filters...)
}

func saveOutput(filename, format string, paths []string, issues []*gosec.Issue, metrics *gosec.Metrics, errors map[string][]gosec.Error) error {
	rootPaths := []string{}
	for _, path := range paths {
		rootPath, err := gosec.RootPath(path)
		if err != nil {
			return fmt.Errorf("failed to get the root path of the projects: %s", err)
		}
		rootPaths = append(rootPaths, rootPath)
	}
	if filename != "" {
		outfile, err := os.Create(filename)
		if err != nil {
			return err
		}
		defer outfile.Close()
		err = output.CreateReport(outfile, format, rootPaths, issues, metrics, errors)
		if err != nil {
			return err
		}
	} else {
		err := output.CreateReport(os.Stdout, format, rootPaths, issues, metrics, errors)
		if err != nil {
			return err
		}
	}
	return nil
}

func convertToScore(severity string) (gosec.Score, error) {
	severity = strings.ToLower(severity)
	switch severity {
	case "low":
		return gosec.Low, nil
	case "medium":
		return gosec.Medium, nil
	case "high":
		return gosec.High, nil
	default:
		return gosec.Low, fmt.Errorf("provided severity '%s' not valid. Valid options: low, medium, high", severity)
	}
}

func filterIssues(issues []*gosec.Issue, severity gosec.Score, confidence gosec.Score) []*gosec.Issue {
	result := []*gosec.Issue{}
	for _, issue := range issues {
		if issue.Severity >= severity && issue.Confidence >= confidence {
			result = append(result, issue)
		}
	}
	return result
}

func main() {
	// Setup usage description
	flag.Usage = usage

	// Setup the excluded folders from scan
	flag.Var(&flagDirsExclude, "exclude-dir", "Exclude folder from scan (can be specified multiple times)")
	err := flag.Set("exclude-dir", "vendor")
	if err != nil {
		fmt.Fprintf(os.Stderr, "\nError: failed to exclude the %q directory from scan", "vendor")
	}

	// Parse command line arguments
	flag.Parse()

	if *flagVersion {
		fmt.Printf("Version: %s\nGit tag: %s\nBuild date: %s\n", Version, GitTag, BuildDate)
		os.Exit(0)
	}

	// Ensure at least one file was specified
	if flag.NArg() == 0 {
		fmt.Fprintf(os.Stderr, "\nError: FILE [FILE...] or './...' expected\n") // #nosec
		flag.Usage()
		os.Exit(1)
	}

	// Setup logging
	logWriter := os.Stderr
	if *flagLogfile != "" {
		var e error
		logWriter, e = os.Create(*flagLogfile)
		if e != nil {
			flag.Usage()
			log.Fatal(e)
		}
	}

	if *flagQuiet {
		logger = log.New(ioutil.Discard, "", 0)
	} else {
		logger = log.New(logWriter, "[gosec] ", log.LstdFlags)
	}

	failSeverity, err := convertToScore(*flagSeverity)
	if err != nil {
		logger.Fatalf("Invalid severity value: %v", err)
	}

	failConfidence, err := convertToScore(*flagConfidence)
	if err != nil {
		logger.Fatalf("Invalid confidence value: %v", err)
	}

	// Load the analyzer configuration
	config, err := loadConfig(*flagConfig)
	if err != nil {
		logger.Fatal(err)
	}

	// Load enabled rule definitions
	ruleDefinitions := loadRules(*flagRulesInclude, *flagRulesExclude)
	if len(ruleDefinitions) == 0 {
		logger.Fatal("No rules are configured")
	}

	// Create the analyzer
	analyzer := gosec.NewAnalyzer(config, *flagScanTests, logger)
	analyzer.LoadRules(ruleDefinitions.Builders())

	excludedDirs := gosec.ExcludedDirsRegExp(flagDirsExclude)
	var packages []string
	for _, path := range flag.Args() {
		pcks, err := gosec.PackagePaths(path, excludedDirs)
		if err != nil {
			logger.Fatal(err)
		}
		packages = append(packages, pcks...)
	}
	if len(packages) == 0 {
		logger.Fatal("No packages found")
	}

	var buildTags []string
	if *flagBuildTags != "" {
		buildTags = strings.Split(*flagBuildTags, ",")
	}

	if err := analyzer.Process(buildTags, packages...); err != nil {
		logger.Fatal(err)
	}

	// Collect the results
	issues, metrics, errors := analyzer.Report()

	// Sort the issue by severity
	if *flagSortIssues {
		sortIssues(issues)
	}

	// Filter the issues by severity and confidence
	issues = filterIssues(issues, failSeverity, failConfidence)
	if metrics.NumFound != len(issues) {
		metrics.NumFound = len(issues)
	}

	// Exit quietly if nothing was found
	if len(issues) == 0 && *flagQuiet {
		os.Exit(0)
	}

	// Create output report
	if err := saveOutput(*flagOutput, *flagFormat, flag.Args(), issues, metrics, errors); err != nil {
		logger.Fatal(err)
	}

	// Finalize logging
	logWriter.Close() // #nosec

	// Do we have an issue? If so exit 1 unless NoFail is set
	if (len(issues) > 0 || len(errors) > 0) && !*flagNoFail {
		os.Exit(1)
	}
}
