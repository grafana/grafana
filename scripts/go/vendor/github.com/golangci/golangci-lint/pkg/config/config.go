package config

import (
	"errors"
	"fmt"
	"regexp"
	"time"
)

const (
	OutFormatJSON              = "json"
	OutFormatLineNumber        = "line-number"
	OutFormatColoredLineNumber = "colored-line-number"
	OutFormatTab               = "tab"
	OutFormatCheckstyle        = "checkstyle"
	OutFormatCodeClimate       = "code-climate"
	OutFormatJunitXML          = "junit-xml"
)

var OutFormats = []string{
	OutFormatColoredLineNumber,
	OutFormatLineNumber,
	OutFormatJSON,
	OutFormatTab,
	OutFormatCheckstyle,
	OutFormatCodeClimate,
	OutFormatJunitXML,
}

type ExcludePattern struct {
	Pattern string
	Linter  string
	Why     string
}

var DefaultExcludePatterns = []ExcludePattern{
	{
		Pattern: "Error return value of .((os\\.)?std(out|err)\\..*|.*Close" +
			"|.*Flush|os\\.Remove(All)?|.*printf?|os\\.(Un)?Setenv). is not checked",
		Linter: "errcheck",
		Why:    "Almost all programs ignore errors on these functions and in most cases it's ok",
	},
	{
		Pattern: "(comment on exported (method|function|type|const)|" +
			"should have( a package)? comment|comment should be of the form)",
		Linter: "golint",
		Why:    "Annoying issue about not having a comment. The rare codebase has such comments",
	},
	{
		Pattern: "func name will be used as test\\.Test.* by other packages, and that stutters; consider calling this",
		Linter:  "golint",
		Why:     "False positive when tests are defined in package 'test'",
	},
	{
		Pattern: "(possible misuse of unsafe.Pointer|should have signature)",
		Linter:  "govet",
		Why:     "Common false positives",
	},
	{
		Pattern: "ineffective break statement. Did you mean to break out of the outer loop",
		Linter:  "staticcheck",
		Why:     "Developers tend to write in C-style with an explicit 'break' in a 'switch', so it's ok to ignore",
	},
	{
		Pattern: "Use of unsafe calls should be audited",
		Linter:  "gosec",
		Why:     "Too many false-positives on 'unsafe' usage",
	},
	{
		Pattern: "Subprocess launch(ed with variable|ing should be audited)",
		Linter:  "gosec",
		Why:     "Too many false-positives for parametrized shell calls",
	},
	{
		Pattern: "G104",
		Linter:  "gosec",
		Why:     "Duplicated errcheck checks",
	},
	{
		Pattern: "(Expect directory permissions to be 0750 or less|Expect file permissions to be 0600 or less)",
		Linter:  "gosec",
		Why:     "Too many issues in popular repos",
	},
	{
		Pattern: "Potential file inclusion via variable",
		Linter:  "gosec",
		Why:     "False positive is triggered by 'src, err := ioutil.ReadFile(filename)'",
	},
}

func GetDefaultExcludePatternsStrings() []string {
	var ret []string
	for _, p := range DefaultExcludePatterns {
		ret = append(ret, p.Pattern)
	}

	return ret
}

type Run struct {
	IsVerbose           bool `mapstructure:"verbose"`
	Silent              bool
	CPUProfilePath      string
	MemProfilePath      string
	TracePath           string
	Concurrency         int
	PrintResourcesUsage bool `mapstructure:"print-resources-usage"`

	Config   string
	NoConfig bool

	Args []string

	BuildTags           []string `mapstructure:"build-tags"`
	ModulesDownloadMode string   `mapstructure:"modules-download-mode"`

	ExitCodeIfIssuesFound int  `mapstructure:"issues-exit-code"`
	AnalyzeTests          bool `mapstructure:"tests"`
	Deadline              time.Duration
	PrintVersion          bool

	SkipFiles          []string `mapstructure:"skip-files"`
	SkipDirs           []string `mapstructure:"skip-dirs"`
	UseDefaultSkipDirs bool     `mapstructure:"skip-dirs-use-default"`
}

type LintersSettings struct {
	Govet  GovetSettings
	Golint struct {
		MinConfidence float64 `mapstructure:"min-confidence"`
	}
	Gofmt struct {
		Simplify bool
	}
	Goimports struct {
		LocalPrefixes string `mapstructure:"local-prefixes"`
	}
	Gocyclo struct {
		MinComplexity int `mapstructure:"min-complexity"`
	}
	Varcheck struct {
		CheckExportedFields bool `mapstructure:"exported-fields"`
	}
	Structcheck struct {
		CheckExportedFields bool `mapstructure:"exported-fields"`
	}
	Maligned struct {
		SuggestNewOrder bool `mapstructure:"suggest-new"`
	}
	Dupl struct {
		Threshold int
	}
	Goconst struct {
		MinStringLen        int `mapstructure:"min-len"`
		MinOccurrencesCount int `mapstructure:"min-occurrences"`
	}
	Depguard struct {
		ListType                 string `mapstructure:"list-type"`
		Packages                 []string
		IncludeGoRoot            bool              `mapstructure:"include-go-root"`
		PackagesWithErrorMessage map[string]string `mapstructure:"packages-with-error-message"`
	}
	Misspell struct {
		Locale      string
		IgnoreWords []string `mapstructure:"ignore-words"`
	}
	Unused struct {
		CheckExported bool `mapstructure:"check-exported"`
	}
	Funlen struct {
		Lines      int
		Statements int
	}
	Whitespace struct {
		MultiIf   bool `mapstructure:"multi-if"`
		MultiFunc bool `mapstructure:"multi-func"`
	}

	Lll      LllSettings
	Unparam  UnparamSettings
	Nakedret NakedretSettings
	Prealloc PreallocSettings
	Errcheck ErrcheckSettings
	Gocritic GocriticSettings
	Godox    GodoxSettings
	Dogsled  DogsledSettings
	Gocognit GocognitSettings
}

type GovetSettings struct {
	CheckShadowing bool `mapstructure:"check-shadowing"`
	Settings       map[string]map[string]interface{}

	Enable     []string
	Disable    []string
	EnableAll  bool `mapstructure:"enable-all"`
	DisableAll bool `mapstructure:"disable-all"`
}

func (cfg GovetSettings) Validate() error {
	if cfg.EnableAll && cfg.DisableAll {
		return errors.New("enable-all and disable-all can't be combined")
	}
	if cfg.EnableAll && len(cfg.Enable) != 0 {
		return errors.New("enable-all and enable can't be combined")
	}
	if cfg.DisableAll && len(cfg.Disable) != 0 {
		return errors.New("disable-all and disable can't be combined")
	}
	return nil
}

type ErrcheckSettings struct {
	CheckTypeAssertions bool   `mapstructure:"check-type-assertions"`
	CheckAssignToBlank  bool   `mapstructure:"check-blank"`
	Ignore              string `mapstructure:"ignore"`
	Exclude             string `mapstructure:"exclude"`
}

type LllSettings struct {
	LineLength int `mapstructure:"line-length"`
	TabWidth   int `mapstructure:"tab-width"`
}

type UnparamSettings struct {
	CheckExported bool `mapstructure:"check-exported"`
	Algo          string
}

type NakedretSettings struct {
	MaxFuncLines int `mapstructure:"max-func-lines"`
}

type PreallocSettings struct {
	Simple     bool
	RangeLoops bool `mapstructure:"range-loops"`
	ForLoops   bool `mapstructure:"for-loops"`
}

type GodoxSettings struct {
	Keywords []string
}

type DogsledSettings struct {
	MaxBlankIdentifiers int `mapstructure:"max-blank-identifiers"`
}

type GocognitSettings struct {
	MinComplexity int `mapstructure:"min-complexity"`
}

var defaultLintersSettings = LintersSettings{
	Lll: LllSettings{
		LineLength: 120,
		TabWidth:   1,
	},
	Unparam: UnparamSettings{
		Algo: "cha",
	},
	Nakedret: NakedretSettings{
		MaxFuncLines: 30,
	},
	Prealloc: PreallocSettings{
		Simple:     true,
		RangeLoops: true,
		ForLoops:   false,
	},
	Gocritic: GocriticSettings{
		SettingsPerCheck: map[string]GocriticCheckSettings{},
	},
	Godox: GodoxSettings{
		Keywords: []string{},
	},
	Dogsled: DogsledSettings{
		MaxBlankIdentifiers: 2,
	},
	Gocognit: GocognitSettings{
		MinComplexity: 30,
	},
}

type Linters struct {
	Enable     []string
	Disable    []string
	EnableAll  bool `mapstructure:"enable-all"`
	DisableAll bool `mapstructure:"disable-all"`
	Fast       bool

	Presets []string
}

type ExcludeRule struct {
	Linters []string
	Path    string
	Text    string
	Source  string
}

func validateOptionalRegex(value string) error {
	if value == "" {
		return nil
	}
	_, err := regexp.Compile(value)
	return err
}

func (e ExcludeRule) Validate() error {
	if err := validateOptionalRegex(e.Path); err != nil {
		return fmt.Errorf("invalid path regex: %v", err)
	}
	if err := validateOptionalRegex(e.Text); err != nil {
		return fmt.Errorf("invalid text regex: %v", err)
	}
	if err := validateOptionalRegex(e.Source); err != nil {
		return fmt.Errorf("invalid source regex: %v", err)
	}
	nonBlank := 0
	if len(e.Linters) > 0 {
		nonBlank++
	}
	if e.Path != "" {
		nonBlank++
	}
	if e.Text != "" {
		nonBlank++
	}
	if e.Source != "" {
		nonBlank++
	}
	if nonBlank < 2 {
		return errors.New("at least 2 of (text, source, path, linters) should be set")
	}
	return nil
}

type Issues struct {
	ExcludePatterns    []string      `mapstructure:"exclude"`
	ExcludeRules       []ExcludeRule `mapstructure:"exclude-rules"`
	UseDefaultExcludes bool          `mapstructure:"exclude-use-default"`

	MaxIssuesPerLinter int `mapstructure:"max-issues-per-linter"`
	MaxSameIssues      int `mapstructure:"max-same-issues"`

	DiffFromRevision  string `mapstructure:"new-from-rev"`
	DiffPatchFilePath string `mapstructure:"new-from-patch"`
	Diff              bool   `mapstructure:"new"`

	NeedFix bool `mapstructure:"fix"`
}

type Config struct {
	Run Run

	Output struct {
		Format              string
		Color               string
		PrintIssuedLine     bool `mapstructure:"print-issued-lines"`
		PrintLinterName     bool `mapstructure:"print-linter-name"`
		PrintWelcomeMessage bool `mapstructure:"print-welcome"`
	}

	LintersSettings LintersSettings `mapstructure:"linters-settings"`
	Linters         Linters
	Issues          Issues

	InternalTest bool // Option is used only for testing golangci-lint code, don't use it
}

func NewDefault() *Config {
	return &Config{
		LintersSettings: defaultLintersSettings,
	}
}
