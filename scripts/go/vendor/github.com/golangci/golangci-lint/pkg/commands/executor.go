package commands

import (
	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"

	"github.com/golangci/golangci-lint/internal/pkgcache"
	"github.com/golangci/golangci-lint/pkg/config"
	"github.com/golangci/golangci-lint/pkg/fsutils"
	"github.com/golangci/golangci-lint/pkg/golinters/goanalysis/load"
	"github.com/golangci/golangci-lint/pkg/goutil"
	"github.com/golangci/golangci-lint/pkg/lint"
	"github.com/golangci/golangci-lint/pkg/lint/lintersdb"
	"github.com/golangci/golangci-lint/pkg/logutils"
	"github.com/golangci/golangci-lint/pkg/report"
	"github.com/golangci/golangci-lint/pkg/timeutils"
)

type Executor struct {
	rootCmd *cobra.Command
	runCmd  *cobra.Command

	exitCode              int
	version, commit, date string

	cfg               *config.Config
	log               logutils.Log
	reportData        report.Data
	DBManager         *lintersdb.Manager
	EnabledLintersSet *lintersdb.EnabledSet
	contextLoader     *lint.ContextLoader
	goenv             *goutil.Env
	fileCache         *fsutils.FileCache
	lineCache         *fsutils.LineCache
	pkgCache          *pkgcache.Cache
	debugf            logutils.DebugFunc
	sw                *timeutils.Stopwatch

	loadGuard *load.Guard
}

func NewExecutor(version, commit, date string) *Executor {
	e := &Executor{
		cfg:       config.NewDefault(),
		version:   version,
		commit:    commit,
		date:      date,
		DBManager: lintersdb.NewManager(nil),
		debugf:    logutils.Debug("exec"),
	}

	e.debugf("Starting execution...")
	e.log = report.NewLogWrapper(logutils.NewStderrLog(""), &e.reportData)

	// to setup log level early we need to parse config from command line extra time to
	// find `-v` option
	commandLineCfg, err := e.getConfigForCommandLine()
	if err != nil && err != pflag.ErrHelp {
		e.log.Fatalf("Can't get config for command line: %s", err)
	}
	if commandLineCfg != nil {
		logutils.SetupVerboseLog(e.log, commandLineCfg.Run.IsVerbose)

		switch commandLineCfg.Output.Color {
		case "always":
			color.NoColor = false
		case "never":
			color.NoColor = true
		case "auto":
			// nothing
		default:
			e.log.Fatalf("invalid value %q for --color; must be 'always', 'auto', or 'never'", commandLineCfg.Output.Color)
		}
	}

	// init of commands must be done before config file reading because
	// init sets config with the default values of flags
	e.initRoot()
	e.initRun()
	e.initHelp()
	e.initLinters()
	e.initConfig()
	e.initCompletion()
	e.initVersion()

	// init e.cfg by values from config: flags parse will see these values
	// like the default ones. It will overwrite them only if the same option
	// is found in command-line: it's ok, command-line has higher priority.

	r := config.NewFileReader(e.cfg, commandLineCfg, e.log.Child("config_reader"))
	if err = r.Read(); err != nil {
		e.log.Fatalf("Can't read config: %s", err)
	}

	// recreate after getting config
	e.DBManager = lintersdb.NewManager(e.cfg)

	e.cfg.LintersSettings.Gocritic.InferEnabledChecks(e.log)
	if err = e.cfg.LintersSettings.Gocritic.Validate(e.log); err != nil {
		e.log.Fatalf("Invalid gocritic settings: %s", err)
	}

	// Slice options must be explicitly set for proper merging of config and command-line options.
	fixSlicesFlags(e.runCmd.Flags())

	e.EnabledLintersSet = lintersdb.NewEnabledSet(e.DBManager,
		lintersdb.NewValidator(e.DBManager), e.log.Child("lintersdb"), e.cfg)
	e.goenv = goutil.NewEnv(e.log.Child("goenv"))
	e.fileCache = fsutils.NewFileCache()
	e.lineCache = fsutils.NewLineCache(e.fileCache)

	e.sw = timeutils.NewStopwatch("pkgcache", e.log.Child("stopwatch"))
	e.pkgCache, err = pkgcache.NewCache(e.sw, e.log.Child("pkgcache"))
	if err != nil {
		e.log.Fatalf("Failed to build packages cache: %s", err)
	}
	e.loadGuard = load.NewGuard()
	e.contextLoader = lint.NewContextLoader(e.cfg, e.log.Child("loader"), e.goenv,
		e.lineCache, e.fileCache, e.pkgCache, e.loadGuard)
	e.debugf("Initialized executor")
	return e
}

func (e *Executor) Execute() error {
	return e.rootCmd.Execute()
}
