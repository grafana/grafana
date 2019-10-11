package commands

import (
	"context"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/fatih/color"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"

	"github.com/golangci/golangci-lint/pkg/config"
	"github.com/golangci/golangci-lint/pkg/exitcodes"
	"github.com/golangci/golangci-lint/pkg/lint"
	"github.com/golangci/golangci-lint/pkg/lint/lintersdb"
	"github.com/golangci/golangci-lint/pkg/logutils"
	"github.com/golangci/golangci-lint/pkg/packages"
	"github.com/golangci/golangci-lint/pkg/printers"
	"github.com/golangci/golangci-lint/pkg/result"
	"github.com/golangci/golangci-lint/pkg/result/processors"
)

func getDefaultIssueExcludeHelp() string {
	parts := []string{"Use or not use default excludes:"}
	for _, ep := range config.DefaultExcludePatterns {
		parts = append(parts,
			fmt.Sprintf("  # %s: %s", ep.Linter, ep.Why),
			fmt.Sprintf("  - %s", color.YellowString(ep.Pattern)),
			"",
		)
	}
	return strings.Join(parts, "\n")
}

func getDefaultDirectoryExcludeHelp() string {
	parts := []string{"Use or not use default excluded directories:"}
	for _, dir := range packages.StdExcludeDirRegexps {
		parts = append(parts, fmt.Sprintf("  - %s", color.YellowString(dir)))
	}
	parts = append(parts, "")
	return strings.Join(parts, "\n")
}

const welcomeMessage = "Run this tool in cloud on every github pull " +
	"request in https://golangci.com for free (public repos)"

func wh(text string) string {
	return color.GreenString(text)
}

//nolint:funlen
func initFlagSet(fs *pflag.FlagSet, cfg *config.Config, m *lintersdb.Manager, isFinalInit bool) {
	hideFlag := func(name string) {
		if err := fs.MarkHidden(name); err != nil {
			panic(err)
		}

		// we run initFlagSet multiple times, but we wouldn't like to see deprecation message multiple times
		if isFinalInit {
			const deprecateMessage = "flag will be removed soon, please, use .golangci.yml config"
			if err := fs.MarkDeprecated(name, deprecateMessage); err != nil {
				panic(err)
			}
		}
	}

	// Output config
	oc := &cfg.Output
	fs.StringVar(&oc.Format, "out-format",
		config.OutFormatColoredLineNumber,
		wh(fmt.Sprintf("Format of output: %s", strings.Join(config.OutFormats, "|"))))
	fs.BoolVar(&oc.PrintIssuedLine, "print-issued-lines", true, wh("Print lines of code with issue"))
	fs.BoolVar(&oc.PrintLinterName, "print-linter-name", true, wh("Print linter name in issue line"))
	fs.BoolVar(&oc.PrintWelcomeMessage, "print-welcome", false, wh("Print welcome message"))
	hideFlag("print-welcome") // no longer used

	// Run config
	rc := &cfg.Run
	fs.IntVar(&rc.ExitCodeIfIssuesFound, "issues-exit-code",
		exitcodes.IssuesFound, wh("Exit code when issues were found"))
	fs.StringSliceVar(&rc.BuildTags, "build-tags", nil, wh("Build tags"))
	fs.DurationVar(&rc.Deadline, "deadline", time.Minute, wh("Deadline for total work"))
	fs.BoolVar(&rc.AnalyzeTests, "tests", true, wh("Analyze tests (*_test.go)"))
	fs.BoolVar(&rc.PrintResourcesUsage, "print-resources-usage", false,
		wh("Print avg and max memory usage of golangci-lint and total time"))
	fs.StringVarP(&rc.Config, "config", "c", "", wh("Read config from file path `PATH`"))
	fs.BoolVar(&rc.NoConfig, "no-config", false, wh("Don't read config"))
	fs.StringSliceVar(&rc.SkipDirs, "skip-dirs", nil, wh("Regexps of directories to skip"))
	fs.BoolVar(&rc.UseDefaultSkipDirs, "skip-dirs-use-default", true, getDefaultDirectoryExcludeHelp())
	fs.StringSliceVar(&rc.SkipFiles, "skip-files", nil, wh("Regexps of files to skip"))

	// Linters settings config
	lsc := &cfg.LintersSettings

	// Hide all linters settings flags: they were initially visible,
	// but when number of linters started to grow it became obvious that
	// we can't fill 90% of flags by linters settings: common flags became hard to find.
	// New linters settings should be done only through config file.
	fs.BoolVar(&lsc.Errcheck.CheckTypeAssertions, "errcheck.check-type-assertions",
		false, "Errcheck: check for ignored type assertion results")
	hideFlag("errcheck.check-type-assertions")
	fs.BoolVar(&lsc.Errcheck.CheckAssignToBlank, "errcheck.check-blank", false,
		"Errcheck: check for errors assigned to blank identifier: _ = errFunc()")
	hideFlag("errcheck.check-blank")
	fs.StringVar(&lsc.Errcheck.Exclude, "errcheck.exclude", "",
		"Path to a file containing a list of functions to exclude from checking")
	hideFlag("errcheck.exclude")
	fs.StringVar(&lsc.Errcheck.Ignore, "errcheck.ignore", "fmt:.*",
		`Comma-separated list of pairs of the form pkg:regex. The regex is used to ignore names within pkg`)
	hideFlag("errcheck.ignore")

	fs.BoolVar(&lsc.Govet.CheckShadowing, "govet.check-shadowing", false,
		"Govet: check for shadowed variables")
	hideFlag("govet.check-shadowing")

	fs.Float64Var(&lsc.Golint.MinConfidence, "golint.min-confidence", 0.8,
		"Golint: minimum confidence of a problem to print it")
	hideFlag("golint.min-confidence")

	fs.BoolVar(&lsc.Gofmt.Simplify, "gofmt.simplify", true, "Gofmt: simplify code")
	hideFlag("gofmt.simplify")

	fs.IntVar(&lsc.Gocyclo.MinComplexity, "gocyclo.min-complexity",
		30, "Minimal complexity of function to report it")
	hideFlag("gocyclo.min-complexity")

	fs.BoolVar(&lsc.Maligned.SuggestNewOrder, "maligned.suggest-new", false,
		"Maligned: print suggested more optimal struct fields ordering")
	hideFlag("maligned.suggest-new")

	fs.IntVar(&lsc.Dupl.Threshold, "dupl.threshold",
		150, "Dupl: Minimal threshold to detect copy-paste")
	hideFlag("dupl.threshold")

	fs.IntVar(&lsc.Goconst.MinStringLen, "goconst.min-len",
		3, "Goconst: minimum constant string length")
	hideFlag("goconst.min-len")
	fs.IntVar(&lsc.Goconst.MinOccurrencesCount, "goconst.min-occurrences",
		3, "Goconst: minimum occurrences of constant string count to trigger issue")
	hideFlag("goconst.min-occurrences")

	// (@dixonwille) These flag is only used for testing purposes.
	fs.StringSliceVar(&lsc.Depguard.Packages, "depguard.packages", nil,
		"Depguard: packages to add to the list")
	hideFlag("depguard.packages")

	fs.BoolVar(&lsc.Depguard.IncludeGoRoot, "depguard.include-go-root", false,
		"Depguard: check list against standard lib")
	hideFlag("depguard.include-go-root")

	fs.IntVar(&lsc.Lll.TabWidth, "lll.tab-width", 1,
		"Lll: tab width in spaces")
	hideFlag("lll.tab-width")

	// Linters config
	lc := &cfg.Linters
	fs.StringSliceVarP(&lc.Enable, "enable", "E", nil, wh("Enable specific linter"))
	fs.StringSliceVarP(&lc.Disable, "disable", "D", nil, wh("Disable specific linter"))
	fs.BoolVar(&lc.EnableAll, "enable-all", false, wh("Enable all linters"))
	fs.BoolVar(&lc.DisableAll, "disable-all", false, wh("Disable all linters"))
	fs.StringSliceVarP(&lc.Presets, "presets", "p", nil,
		wh(fmt.Sprintf("Enable presets (%s) of linters. Run 'golangci-lint linters' to see "+
			"them. This option implies option --disable-all", strings.Join(m.AllPresets(), "|"))))
	fs.BoolVar(&lc.Fast, "fast", false, wh("Run only fast linters from enabled linters set (first run won't be fast)"))

	// Issues config
	ic := &cfg.Issues
	fs.StringSliceVarP(&ic.ExcludePatterns, "exclude", "e", nil, wh("Exclude issue by regexp"))
	fs.BoolVar(&ic.UseDefaultExcludes, "exclude-use-default", true, getDefaultIssueExcludeHelp())

	fs.IntVar(&ic.MaxIssuesPerLinter, "max-issues-per-linter", 50,
		wh("Maximum issues count per one linter. Set to 0 to disable"))
	fs.IntVar(&ic.MaxSameIssues, "max-same-issues", 3,
		wh("Maximum count of issues with the same text. Set to 0 to disable"))

	fs.BoolVarP(&ic.Diff, "new", "n", false,
		wh("Show only new issues: if there are unstaged changes or untracked files, only those changes "+
			"are analyzed, else only changes in HEAD~ are analyzed.\nIt's a super-useful option for integration "+
			"of golangci-lint into existing large codebase.\nIt's not practical to fix all existing issues at "+
			"the moment of integration: much better to not allow issues in new code.\nFor CI setups, prefer "+
			"--new-from-rev=HEAD~, as --new can skip linting the current patch if any scripts generate "+
			"unstaged files before golangci-lint runs."))
	fs.StringVar(&ic.DiffFromRevision, "new-from-rev", "",
		wh("Show only new issues created after git revision `REV`"))
	fs.StringVar(&ic.DiffPatchFilePath, "new-from-patch", "",
		wh("Show only new issues created in git patch with file path `PATH`"))
	fs.BoolVar(&ic.NeedFix, "fix", false, "Fix found issues (if it's supported by the linter)")
}

func (e *Executor) initRunConfiguration(cmd *cobra.Command) {
	fs := cmd.Flags()
	fs.SortFlags = false // sort them as they are defined here
	initFlagSet(fs, e.cfg, e.DBManager, true)
}

func (e *Executor) getConfigForCommandLine() (*config.Config, error) {
	// We use another pflag.FlagSet here to not set `changed` flag
	// on cmd.Flags() options. Otherwise string slice options will be duplicated.
	fs := pflag.NewFlagSet("config flag set", pflag.ContinueOnError)

	var cfg config.Config
	// Don't do `fs.AddFlagSet(cmd.Flags())` because it shares flags representations:
	// `changed` variable inside string slice vars will be shared.
	// Use another config variable here, not e.cfg, to not
	// affect main parsing by this parsing of only config option.
	initFlagSet(fs, &cfg, e.DBManager, false)

	// Parse max options, even force version option: don't want
	// to get access to Executor here: it's error-prone to use
	// cfg vs e.cfg.
	initRootFlagSet(fs, &cfg, true)

	fs.Usage = func() {} // otherwise help text will be printed twice
	if err := fs.Parse(os.Args); err != nil {
		if err == pflag.ErrHelp {
			return nil, err
		}

		return nil, fmt.Errorf("can't parse args: %s", err)
	}

	return &cfg, nil
}

func (e *Executor) initRun() {
	e.runCmd = &cobra.Command{
		Use:   "run",
		Short: welcomeMessage,
		Run:   e.executeRun,
	}
	e.rootCmd.AddCommand(e.runCmd)

	e.runCmd.SetOutput(logutils.StdOut) // use custom output to properly color it in Windows terminals

	e.initRunConfiguration(e.runCmd)
}

func fixSlicesFlags(fs *pflag.FlagSet) {
	// It's a dirty hack to set flag.Changed to true for every string slice flag.
	// It's necessary to merge config and command-line slices: otherwise command-line
	// flags will always overwrite ones from the config.
	fs.VisitAll(func(f *pflag.Flag) {
		if f.Value.Type() != "stringSlice" {
			return
		}

		s, err := fs.GetStringSlice(f.Name)
		if err != nil {
			return
		}

		if s == nil { // assume that every string slice flag has nil as the default
			return
		}

		// calling Set sets Changed to true: next Set calls will append, not overwrite
		_ = f.Value.Set(strings.Join(s, ","))
	})
}

func (e *Executor) runAnalysis(ctx context.Context, args []string) ([]result.Issue, error) {
	e.cfg.Run.Args = args

	enabledLinters, err := e.EnabledLintersSet.Get(true)
	if err != nil {
		return nil, err
	}

	for _, lc := range e.DBManager.GetAllSupportedLinterConfigs() {
		isEnabled := false
		for _, enabledLC := range enabledLinters {
			if enabledLC.Name() == lc.Name() {
				isEnabled = true
				break
			}
		}
		e.reportData.AddLinter(lc.Name(), isEnabled, lc.EnabledByDefault)
	}

	lintCtx, err := e.contextLoader.Load(ctx, enabledLinters)
	if err != nil {
		return nil, errors.Wrap(err, "context loading failed")
	}
	lintCtx.Log = e.log.Child("linters context")

	runner, err := lint.NewRunner(e.cfg, e.log.Child("runner"),
		e.goenv, e.lineCache, e.DBManager, lintCtx.Packages)
	if err != nil {
		return nil, err
	}

	issues := runner.Run(ctx, enabledLinters, lintCtx)
	fixer := processors.NewFixer(e.cfg, e.log, e.fileCache)
	return fixer.Process(issues), nil
}

func (e *Executor) setOutputToDevNull() (savedStdout, savedStderr *os.File) {
	savedStdout, savedStderr = os.Stdout, os.Stderr
	devNull, err := os.Open(os.DevNull)
	if err != nil {
		e.log.Warnf("Can't open null device %q: %s", os.DevNull, err)
		return
	}

	os.Stdout, os.Stderr = devNull, devNull
	return
}

func (e *Executor) setExitCodeIfIssuesFound(issues []result.Issue) {
	if len(issues) != 0 {
		e.exitCode = e.cfg.Run.ExitCodeIfIssuesFound
	}
}

func (e *Executor) runAndPrint(ctx context.Context, args []string) error {
	if err := e.goenv.Discover(ctx); err != nil {
		e.log.Warnf("Failed to discover go env: %s", err)
	}

	if !logutils.HaveDebugTag("linters_output") {
		// Don't allow linters and loader to print anything
		log.SetOutput(ioutil.Discard)
		savedStdout, savedStderr := e.setOutputToDevNull()
		defer func() {
			os.Stdout, os.Stderr = savedStdout, savedStderr
		}()
	}

	issues, err := e.runAnalysis(ctx, args)
	if err != nil {
		return err // XXX: don't loose type
	}

	p, err := e.createPrinter()
	if err != nil {
		return err
	}

	e.setExitCodeIfIssuesFound(issues)

	if err = p.Print(ctx, issues); err != nil {
		return fmt.Errorf("can't print %d issues: %s", len(issues), err)
	}

	e.fileCache.PrintStats(e.log)

	return nil
}

func (e *Executor) createPrinter() (printers.Printer, error) {
	var p printers.Printer
	format := e.cfg.Output.Format
	switch format {
	case config.OutFormatJSON:
		p = printers.NewJSON(&e.reportData)
	case config.OutFormatColoredLineNumber, config.OutFormatLineNumber:
		p = printers.NewText(e.cfg.Output.PrintIssuedLine,
			format == config.OutFormatColoredLineNumber, e.cfg.Output.PrintLinterName,
			e.log.Child("text_printer"))
	case config.OutFormatTab:
		p = printers.NewTab(e.cfg.Output.PrintLinterName, e.log.Child("tab_printer"))
	case config.OutFormatCheckstyle:
		p = printers.NewCheckstyle()
	case config.OutFormatCodeClimate:
		p = printers.NewCodeClimate()
	case config.OutFormatJunitXML:
		p = printers.NewJunitXML()
	default:
		return nil, fmt.Errorf("unknown output format %s", format)
	}

	return p, nil
}

func (e *Executor) executeRun(_ *cobra.Command, args []string) {
	needTrackResources := e.cfg.Run.IsVerbose || e.cfg.Run.PrintResourcesUsage
	trackResourcesEndCh := make(chan struct{})
	defer func() { // XXX: this defer must be before ctx.cancel defer
		if needTrackResources { // wait until resource tracking finished to print properly
			<-trackResourcesEndCh
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), e.cfg.Run.Deadline)
	defer cancel()

	if needTrackResources {
		go watchResources(ctx, trackResourcesEndCh, e.log, e.debugf)
	}

	if err := e.runAndPrint(ctx, args); err != nil {
		e.log.Errorf("Running error: %s", err)
		if e.exitCode == exitcodes.Success {
			if exitErr, ok := errors.Cause(err).(*exitcodes.ExitError); ok {
				e.exitCode = exitErr.Code
			} else {
				e.exitCode = exitcodes.Failure
			}
		}
	}

	e.setupExitCode(ctx)
}

func (e *Executor) setupExitCode(ctx context.Context) {
	if ctx.Err() != nil {
		e.exitCode = exitcodes.Timeout
		e.log.Errorf("Deadline exceeded: try increase it by passing --deadline option")
		return
	}

	if e.exitCode != exitcodes.Success {
		return
	}

	needFailOnWarnings := (os.Getenv("GL_TEST_RUN") == "1" || os.Getenv("FAIL_ON_WARNINGS") == "1")
	if needFailOnWarnings && len(e.reportData.Warnings) != 0 {
		e.exitCode = exitcodes.WarningInTest
		return
	}

	if e.reportData.Error != "" {
		// it's a case e.g. when typecheck linter couldn't parse and error and just logged it
		e.exitCode = exitcodes.ErrorWasLogged
		return
	}
}

func watchResources(ctx context.Context, done chan struct{}, logger logutils.Log, debugf logutils.DebugFunc) {
	startedAt := time.Now()
	debugf("Started tracking time")

	var maxRSSMB, totalRSSMB float64
	var iterationsCount int
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	logEveryRecord := os.Getenv("GL_MEM_LOG_EVERY") == "1"
	const MB = 1024 * 1024

	track := func() {
		debugf("Starting memory tracing iteration ...")
		var m runtime.MemStats
		runtime.ReadMemStats(&m)

		if logEveryRecord {
			debugf("Stopping memory tracing iteration, printing ...")
			printMemStats(&m, logger)
		}

		rssMB := float64(m.Sys) / MB
		if rssMB > maxRSSMB {
			maxRSSMB = rssMB
		}
		totalRSSMB += rssMB
		iterationsCount++
	}

	for {
		track()

		stop := false
		select {
		case <-ctx.Done():
			stop = true
			debugf("Stopped resources tracking")
		case <-ticker.C:
		}

		if stop {
			break
		}
	}
	track()

	avgRSSMB := totalRSSMB / float64(iterationsCount)

	logger.Infof("Memory: %d samples, avg is %.1fMB, max is %.1fMB",
		iterationsCount, avgRSSMB, maxRSSMB)
	logger.Infof("Execution took %s", time.Since(startedAt))
	close(done)
}
