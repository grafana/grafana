package golinters

import (
	"bufio"
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	errcheck "github.com/golangci/errcheck/golangci"
	"github.com/pkg/errors"
	"golang.org/x/tools/go/analysis"

	"github.com/golangci/golangci-lint/pkg/config"
	"github.com/golangci/golangci-lint/pkg/fsutils"
	"github.com/golangci/golangci-lint/pkg/golinters/goanalysis"
	"github.com/golangci/golangci-lint/pkg/lint/linter"
	"github.com/golangci/golangci-lint/pkg/result"
)

func NewErrcheck() *goanalysis.Linter {
	const linterName = "errcheck"
	var mu sync.Mutex
	var res []result.Issue
	analyzer := &analysis.Analyzer{
		Name: goanalysis.TheOnlyAnalyzerName,
		Doc:  goanalysis.TheOnlyanalyzerDoc,
	}
	return goanalysis.NewLinter(
		linterName,
		"Errcheck is a program for checking for unchecked errors "+
			"in go programs. These unchecked errors can be critical bugs in some cases",
		[]*analysis.Analyzer{analyzer},
		nil,
	).WithContextSetter(func(lintCtx *linter.Context) {
		analyzer.Run = func(pass *analysis.Pass) (interface{}, error) {
			prog := goanalysis.MakeFakeLoaderProgram(pass)
			errCfg, err := genConfig(&lintCtx.Settings().Errcheck)
			if err != nil {
				return nil, err
			}
			errcheckIssues, err := errcheck.RunWithConfig(prog, errCfg)
			if err != nil {
				return nil, err
			}

			if len(errcheckIssues) == 0 {
				return nil, nil
			}

			issues := make([]result.Issue, 0, len(errcheckIssues))
			for _, i := range errcheckIssues {
				var text string
				if i.FuncName != "" {
					text = fmt.Sprintf("Error return value of %s is not checked", formatCode(i.FuncName, lintCtx.Cfg))
				} else {
					text = "Error return value is not checked"
				}
				issues = append(issues, result.Issue{
					FromLinter: linterName,
					Text:       text,
					Pos:        i.Pos,
				})
			}
			mu.Lock()
			res = append(res, issues...)
			mu.Unlock()
			return nil, nil
		}
	}).WithIssuesReporter(func(*linter.Context) []result.Issue {
		return res
	}).WithLoadMode(goanalysis.LoadModeTypesInfo)
}

// parseIgnoreConfig was taken from errcheck in order to keep the API identical.
// https://github.com/kisielk/errcheck/blob/1787c4bee836470bf45018cfbc783650db3c6501/main.go#L25-L60
func parseIgnoreConfig(s string) (map[string]*regexp.Regexp, error) {
	if s == "" {
		return nil, nil
	}

	cfg := map[string]*regexp.Regexp{}

	for _, pair := range strings.Split(s, ",") {
		colonIndex := strings.Index(pair, ":")
		var pkg, re string
		if colonIndex == -1 {
			pkg = ""
			re = pair
		} else {
			pkg = pair[:colonIndex]
			re = pair[colonIndex+1:]
		}
		regex, err := regexp.Compile(re)
		if err != nil {
			return nil, err
		}
		cfg[pkg] = regex
	}

	return cfg, nil
}

func genConfig(errCfg *config.ErrcheckSettings) (*errcheck.Config, error) {
	ignoreConfig, err := parseIgnoreConfig(errCfg.Ignore)
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse 'ignore' directive")
	}

	c := &errcheck.Config{
		Ignore:  ignoreConfig,
		Blank:   errCfg.CheckAssignToBlank,
		Asserts: errCfg.CheckTypeAssertions,
	}

	if errCfg.Exclude != "" {
		exclude, err := readExcludeFile(errCfg.Exclude)
		if err != nil {
			return nil, err
		}
		c.Exclude = exclude
	}

	return c, nil
}

func getFirstPathArg() string {
	args := os.Args

	// skip all args ([golangci-lint, run/linters]) before files/dirs list
	for len(args) != 0 {
		if args[0] == "run" {
			args = args[1:]
			break
		}

		args = args[1:]
	}

	// find first file/dir arg
	firstArg := "./..."
	for _, arg := range args {
		if !strings.HasPrefix(arg, "-") {
			firstArg = arg
			break
		}
	}

	return firstArg
}

func setupConfigFileSearch(name string) []string {
	if strings.HasPrefix(name, "~") {
		if u, err := user.Current(); err == nil {
			name = strings.Replace(name, "~", u.HomeDir, 1)
		}
	}

	if filepath.IsAbs(name) {
		return []string{name}
	}

	firstArg := getFirstPathArg()

	absStartPath, err := filepath.Abs(firstArg)
	if err != nil {
		absStartPath = filepath.Clean(firstArg)
	}

	// start from it
	var curDir string
	if fsutils.IsDir(absStartPath) {
		curDir = absStartPath
	} else {
		curDir = filepath.Dir(absStartPath)
	}

	// find all dirs from it up to the root
	configSearchPaths := []string{filepath.Join(".", name)}
	for {
		configSearchPaths = append(configSearchPaths, filepath.Join(curDir, name))
		newCurDir := filepath.Dir(curDir)
		if curDir == newCurDir || newCurDir == "" {
			break
		}
		curDir = newCurDir
	}

	return configSearchPaths
}

func readExcludeFile(name string) (map[string]bool, error) {
	var err error
	var fh *os.File

	for _, path := range setupConfigFileSearch(name) {
		if fh, err = os.Open(path); err == nil {
			break
		}
	}

	if fh == nil {
		return nil, errors.Wrapf(err, "failed reading exclude file: %s", name)
	}
	scanner := bufio.NewScanner(fh)
	exclude := make(map[string]bool)
	for scanner.Scan() {
		exclude[scanner.Text()] = true
	}
	if err := scanner.Err(); err != nil {
		return nil, errors.Wrapf(err, "failed scanning file: %s", name)
	}
	return exclude, nil
}
