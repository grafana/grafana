package lintersdb

import (
	"os"

	"github.com/golangci/golangci-lint/pkg/config"
	"github.com/golangci/golangci-lint/pkg/golinters"
	"github.com/golangci/golangci-lint/pkg/lint/linter"
)

type Manager struct {
	nameToLCs map[string][]*linter.Config
	cfg       *config.Config
}

func NewManager(cfg *config.Config) *Manager {
	m := &Manager{cfg: cfg}
	nameToLCs := make(map[string][]*linter.Config)
	for _, lc := range m.GetAllSupportedLinterConfigs() {
		for _, name := range lc.AllNames() {
			nameToLCs[name] = append(nameToLCs[name], lc)
		}
	}

	m.nameToLCs = nameToLCs
	return m
}

func (Manager) AllPresets() []string {
	return []string{linter.PresetBugs, linter.PresetComplexity, linter.PresetFormatting,
		linter.PresetPerformance, linter.PresetStyle, linter.PresetUnused}
}

func (m Manager) allPresetsSet() map[string]bool {
	ret := map[string]bool{}
	for _, p := range m.AllPresets() {
		ret[p] = true
	}
	return ret
}

func (m Manager) GetLinterConfigs(name string) []*linter.Config {
	return m.nameToLCs[name]
}

func enableLinterConfigs(lcs []*linter.Config, isEnabled func(lc *linter.Config) bool) []*linter.Config {
	var ret []*linter.Config
	for _, lc := range lcs {
		lc := lc
		lc.EnabledByDefault = isEnabled(lc)
		ret = append(ret, lc)
	}

	return ret
}

//nolint:funlen
func (m Manager) GetAllSupportedLinterConfigs() []*linter.Config {
	var govetCfg *config.GovetSettings
	if m.cfg != nil {
		govetCfg = &m.cfg.LintersSettings.Govet
	}
	const megacheckName = "megacheck"
	lcs := []*linter.Config{
		linter.NewConfig(golinters.NewGovet(govetCfg)).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetBugs).
			WithAlternativeNames("vet", "vetshadow").
			WithURL("https://golang.org/cmd/vet/"),
		linter.NewConfig(golinters.NewBodyclose()).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetPerformance, linter.PresetBugs).
			WithURL("https://github.com/timakin/bodyclose"),
		linter.NewConfig(golinters.NewErrcheck()).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetBugs).
			WithURL("https://github.com/kisielk/errcheck"),
		linter.NewConfig(golinters.NewGolint()).
			WithPresets(linter.PresetStyle).
			WithURL("https://github.com/golang/lint"),

		linter.NewConfig(golinters.NewStaticcheck()).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetBugs).
			WithAlternativeNames(megacheckName).
			WithURL("https://staticcheck.io/"),
		linter.NewConfig(golinters.NewUnused()).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetUnused).
			WithAlternativeNames(megacheckName).
			ConsiderSlow().
			WithURL("https://github.com/dominikh/go-tools/tree/master/unused"),
		linter.NewConfig(golinters.NewGosimple()).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetStyle).
			WithAlternativeNames(megacheckName).
			WithURL("https://github.com/dominikh/go-tools/tree/master/simple"),
		linter.NewConfig(golinters.NewStylecheck()).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetStyle).
			WithURL("https://github.com/dominikh/go-tools/tree/master/stylecheck"),

		linter.NewConfig(golinters.NewGosec()).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetBugs).
			WithURL("https://github.com/securego/gosec").
			WithAlternativeNames("gas"),
		linter.NewConfig(golinters.NewStructcheck()).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetUnused).
			WithURL("https://github.com/opennota/check"),
		linter.NewConfig(golinters.NewVarcheck()).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetUnused).
			WithURL("https://github.com/opennota/check"),
		linter.NewConfig(golinters.NewInterfacer()).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetStyle).
			WithURL("https://github.com/mvdan/interfacer"),
		linter.NewConfig(golinters.NewUnconvert()).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetStyle).
			WithURL("https://github.com/mdempsky/unconvert"),
		linter.NewConfig(golinters.NewIneffassign()).
			WithPresets(linter.PresetUnused).
			WithURL("https://github.com/gordonklaus/ineffassign"),
		linter.NewConfig(golinters.NewDupl()).
			WithPresets(linter.PresetStyle).
			WithURL("https://github.com/mibk/dupl"),
		linter.NewConfig(golinters.NewGoconst()).
			WithPresets(linter.PresetStyle).
			WithURL("https://github.com/jgautheron/goconst"),
		linter.NewConfig(golinters.NewDeadcode()).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetUnused).
			WithURL("https://github.com/remyoudompheng/go-misc/tree/master/deadcode"),
		linter.NewConfig(golinters.NewGocyclo()).
			WithPresets(linter.PresetComplexity).
			WithURL("https://github.com/alecthomas/gocyclo"),
		linter.NewConfig(golinters.NewGocognit()).
			WithPresets(linter.PresetComplexity).
			WithURL("https://github.com/uudashr/gocognit"),
		linter.NewConfig(golinters.NewTypecheck()).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetBugs).
			WithURL(""),

		linter.NewConfig(golinters.NewGofmt()).
			WithPresets(linter.PresetFormatting).
			WithAutoFix().
			WithURL("https://golang.org/cmd/gofmt/"),
		linter.NewConfig(golinters.NewGoimports()).
			WithPresets(linter.PresetFormatting).
			WithAutoFix().
			WithURL("https://godoc.org/golang.org/x/tools/cmd/goimports"),
		linter.NewConfig(golinters.NewMaligned()).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetPerformance).
			WithURL("https://github.com/mdempsky/maligned"),
		linter.NewConfig(golinters.NewDepguard()).
			WithLoadForGoAnalysis().
			WithPresets(linter.PresetStyle).
			WithURL("https://github.com/OpenPeeDeeP/depguard"),
		linter.NewConfig(golinters.NewMisspell()).
			WithPresets(linter.PresetStyle).
			WithAutoFix().
			WithURL("https://github.com/client9/misspell"),
		linter.NewConfig(golinters.NewLLL()).
			WithPresets(linter.PresetStyle).
			WithURL("https://github.com/walle/lll"),
		linter.NewConfig(golinters.NewUnparam()).
			WithPresets(linter.PresetUnused).
			WithLoadForGoAnalysis().
			WithURL("https://github.com/mvdan/unparam"),
		linter.NewConfig(golinters.NewDogsled()).
			WithPresets(linter.PresetStyle).
			WithURL("https://github.com/alexkohler/dogsled"),
		linter.NewConfig(golinters.NewNakedret()).
			WithPresets(linter.PresetComplexity).
			WithURL("https://github.com/alexkohler/nakedret"),
		linter.NewConfig(golinters.NewPrealloc()).
			WithPresets(linter.PresetPerformance).
			WithURL("https://github.com/alexkohler/prealloc"),
		linter.NewConfig(golinters.NewScopelint()).
			WithPresets(linter.PresetBugs).
			WithURL("https://github.com/kyoh86/scopelint"),
		linter.NewConfig(golinters.NewGocritic()).
			WithPresets(linter.PresetStyle).
			WithLoadForGoAnalysis().
			WithURL("https://github.com/go-critic/go-critic"),
		linter.NewConfig(golinters.NewGochecknoinits()).
			WithPresets(linter.PresetStyle).
			WithURL("https://github.com/leighmcculloch/gochecknoinits"),
		linter.NewConfig(golinters.NewGochecknoglobals()).
			WithPresets(linter.PresetStyle).
			WithURL("https://github.com/leighmcculloch/gochecknoglobals"),
		linter.NewConfig(golinters.NewGodox()).
			WithPresets(linter.PresetStyle).
			WithURL("https://github.com/matoous/godox"),
		linter.NewConfig(golinters.NewFunlen()).
			WithPresets(linter.PresetStyle).
			WithURL("https://github.com/ultraware/funlen"),
		linter.NewConfig(golinters.NewWhitespace()).
			WithPresets(linter.PresetStyle).
			WithAutoFix().
			WithURL("https://github.com/ultraware/whitespace"),
		linter.NewConfig(golinters.NewWSL()).
			WithPresets(linter.PresetStyle).
			WithURL("https://github.com/bombsimon/wsl"),
	}

	isLocalRun := os.Getenv("GOLANGCI_COM_RUN") == ""
	enabledByDefault := map[string]bool{
		golinters.NewGovet(nil).Name():    true,
		golinters.NewErrcheck().Name():    true,
		golinters.NewStaticcheck().Name(): true,
		golinters.NewUnused().Name():      true,
		golinters.NewGosimple().Name():    true,
		golinters.NewStructcheck().Name(): true,
		golinters.NewVarcheck().Name():    true,
		golinters.NewIneffassign().Name(): true,
		golinters.NewDeadcode().Name():    true,

		// don't typecheck for golangci.com: too many troubles
		golinters.NewTypecheck().Name(): isLocalRun,
	}
	return enableLinterConfigs(lcs, func(lc *linter.Config) bool {
		return enabledByDefault[lc.Name()]
	})
}

func (m Manager) GetAllEnabledByDefaultLinters() []*linter.Config {
	var ret []*linter.Config
	for _, lc := range m.GetAllSupportedLinterConfigs() {
		if lc.EnabledByDefault {
			ret = append(ret, lc)
		}
	}

	return ret
}

func linterConfigsToMap(lcs []*linter.Config) map[string]*linter.Config {
	ret := map[string]*linter.Config{}
	for _, lc := range lcs {
		lc := lc // local copy
		ret[lc.Name()] = lc
	}

	return ret
}

func (m Manager) GetAllLinterConfigsForPreset(p string) []*linter.Config {
	var ret []*linter.Config
	for _, lc := range m.GetAllSupportedLinterConfigs() {
		for _, ip := range lc.InPresets {
			if p == ip {
				ret = append(ret, lc)
				break
			}
		}
	}

	return ret
}
