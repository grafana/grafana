package config

import (
	"fmt"
	"sort"
	"strings"

	"github.com/go-lintpack/lintpack"
	"github.com/pkg/errors"

	_ "github.com/go-critic/go-critic/checkers" // this import register checkers

	"github.com/golangci/golangci-lint/pkg/logutils"
)

const gocriticDebugKey = "gocritic"

var gocriticDebugf = logutils.Debug(gocriticDebugKey)
var isGocriticDebug = logutils.HaveDebugTag(gocriticDebugKey)

var allGocriticCheckers = lintpack.GetCheckersInfo()

type GocriticCheckSettings map[string]interface{}

type GocriticSettings struct {
	EnabledChecks    []string                         `mapstructure:"enabled-checks"`
	DisabledChecks   []string                         `mapstructure:"disabled-checks"`
	EnabledTags      []string                         `mapstructure:"enabled-tags"`
	SettingsPerCheck map[string]GocriticCheckSettings `mapstructure:"settings"`

	inferredEnabledChecks map[string]bool
}

func debugChecksListf(checks []string, format string, args ...interface{}) {
	if isGocriticDebug {
		prefix := fmt.Sprintf(format, args...)
		gocriticDebugf(prefix+" checks (%d): %s", len(checks), sprintStrings(checks))
	}
}

func stringsSliceToSet(ss []string) map[string]bool {
	ret := map[string]bool{}
	for _, s := range ss {
		ret[s] = true
	}

	return ret
}

func buildGocriticTagToCheckersMap() map[string][]string {
	tagToCheckers := map[string][]string{}
	for _, checker := range allGocriticCheckers {
		for _, tag := range checker.Tags {
			tagToCheckers[tag] = append(tagToCheckers[tag], checker.Name)
		}
	}
	return tagToCheckers
}

func gocriticCheckerTagsDebugf() {
	if !isGocriticDebug {
		return
	}

	tagToCheckers := buildGocriticTagToCheckersMap()

	var allTags []string
	for tag := range tagToCheckers {
		allTags = append(allTags, tag)
	}
	sort.Strings(allTags)

	gocriticDebugf("All gocritic existing tags and checks:")
	for _, tag := range allTags {
		debugChecksListf(tagToCheckers[tag], "  tag %q", tag)
	}
}

func (s *GocriticSettings) gocriticDisabledCheckersDebugf() {
	if !isGocriticDebug {
		return
	}

	var disabledCheckers []string
	for _, checker := range allGocriticCheckers {
		if s.inferredEnabledChecks[strings.ToLower(checker.Name)] {
			continue
		}

		disabledCheckers = append(disabledCheckers, checker.Name)
	}

	if len(disabledCheckers) == 0 {
		gocriticDebugf("All checks are enabled")
	} else {
		debugChecksListf(disabledCheckers, "Final not used")
	}
}

func (s *GocriticSettings) InferEnabledChecks(log logutils.Log) {
	gocriticCheckerTagsDebugf()

	enabledByDefaultChecks := getDefaultEnabledGocriticCheckersNames()
	debugChecksListf(enabledByDefaultChecks, "Enabled by default")

	disabledByDefaultChecks := getDefaultDisabledGocriticCheckersNames()
	debugChecksListf(disabledByDefaultChecks, "Disabled by default")

	var enabledChecks []string
	if len(s.EnabledTags) != 0 {
		tagToCheckers := buildGocriticTagToCheckersMap()
		for _, tag := range s.EnabledTags {
			enabledChecks = append(enabledChecks, tagToCheckers[tag]...)
		}
		debugChecksListf(enabledChecks, "Enabled by config tags %s", sprintStrings(s.EnabledTags))
	}

	if !(len(s.EnabledTags) == 0 && len(s.EnabledChecks) != 0) {
		// don't use default checks only if we have no enabled tags and enable some checks manually
		enabledChecks = append(enabledChecks, enabledByDefaultChecks...)
	}

	if len(s.EnabledChecks) != 0 {
		debugChecksListf(s.EnabledChecks, "Enabled by config")

		alreadyEnabledChecksSet := stringsSliceToSet(enabledChecks)
		for _, enabledCheck := range s.EnabledChecks {
			if alreadyEnabledChecksSet[enabledCheck] {
				log.Warnf("No need to enable check %q: it's already enabled", enabledCheck)
				continue
			}
			enabledChecks = append(enabledChecks, enabledCheck)
		}
	}

	if len(s.DisabledChecks) != 0 {
		debugChecksListf(s.DisabledChecks, "Disabled by config")

		enabledChecksSet := stringsSliceToSet(enabledChecks)
		for _, disabledCheck := range s.DisabledChecks {
			if !enabledChecksSet[disabledCheck] {
				log.Warnf("Gocritic check %q was disabled by config, was it's not enabled, no need to disable it",
					disabledCheck)
				continue
			}
			delete(enabledChecksSet, disabledCheck)
		}

		enabledChecks = nil
		for enabledCheck := range enabledChecksSet {
			enabledChecks = append(enabledChecks, enabledCheck)
		}
	}

	s.inferredEnabledChecks = map[string]bool{}
	for _, check := range enabledChecks {
		s.inferredEnabledChecks[strings.ToLower(check)] = true
	}

	debugChecksListf(enabledChecks, "Final used")
	s.gocriticDisabledCheckersDebugf()
}

func validateStringsUniq(ss []string) error {
	set := map[string]bool{}
	for _, s := range ss {
		_, ok := set[s]
		if ok {
			return fmt.Errorf("%q occurs multiple times in list", s)
		}
		set[s] = true
	}

	return nil
}

func (s *GocriticSettings) Validate(log logutils.Log) error {
	if len(s.EnabledTags) == 0 {
		if len(s.EnabledChecks) != 0 && len(s.DisabledChecks) != 0 {
			return errors.New("both enabled and disabled check aren't allowed for gocritic")
		}
	} else {
		if err := validateStringsUniq(s.EnabledTags); err != nil {
			return errors.Wrap(err, "validate enabled tags")
		}

		tagToCheckers := buildGocriticTagToCheckersMap()
		for _, tag := range s.EnabledTags {
			if _, ok := tagToCheckers[tag]; !ok {
				return fmt.Errorf("gocritic tag %q doesn't exist", tag)
			}
		}
	}

	if err := validateStringsUniq(s.EnabledChecks); err != nil {
		return errors.Wrap(err, "validate enabled checks")
	}
	if err := validateStringsUniq(s.DisabledChecks); err != nil {
		return errors.Wrap(err, "validate disabled checks")
	}

	for checkName := range s.SettingsPerCheck {
		if !s.IsCheckEnabled(checkName) {
			log.Warnf("Gocritic settings were provided for not enabled check %q", checkName)
		}
	}

	if err := s.validateCheckerNames(); err != nil {
		return errors.Wrap(err, "validation failed")
	}

	return nil
}

func (s *GocriticSettings) IsCheckEnabled(name string) bool {
	return s.inferredEnabledChecks[strings.ToLower(name)]
}

func sprintAllowedCheckerNames(allowedNames map[string]bool) string {
	var namesSlice []string
	for name := range allowedNames {
		namesSlice = append(namesSlice, name)
	}
	return sprintStrings(namesSlice)
}

func sprintStrings(ss []string) string {
	sort.Strings(ss)
	return fmt.Sprint(ss)
}

func getAllCheckerNames() map[string]bool {
	allCheckerNames := map[string]bool{}
	for _, checker := range allGocriticCheckers {
		allCheckerNames[strings.ToLower(checker.Name)] = true
	}

	return allCheckerNames
}

func isEnabledByDefaultGocriticCheck(info *lintpack.CheckerInfo) bool {
	return !info.HasTag("experimental") &&
		!info.HasTag("opinionated") &&
		!info.HasTag("performance")
}

func getDefaultEnabledGocriticCheckersNames() []string {
	var enabled []string
	for _, info := range allGocriticCheckers {
		// get in sync with lintpack behavior in bindDefaultEnabledList
		// in https://github.com/go-lintpack/lintpack/blob/master/linter/lintmain/internal/check/check.go#L317

		enable := isEnabledByDefaultGocriticCheck(info)
		if enable {
			enabled = append(enabled, info.Name)
		}
	}

	return enabled
}

func getDefaultDisabledGocriticCheckersNames() []string {
	var disabled []string
	for _, info := range allGocriticCheckers {
		// get in sync with lintpack behavior in bindDefaultEnabledList
		// in https://github.com/go-lintpack/lintpack/blob/master/linter/lintmain/internal/check/check.go#L317

		enable := isEnabledByDefaultGocriticCheck(info)
		if !enable {
			disabled = append(disabled, info.Name)
		}
	}

	return disabled
}

func (s *GocriticSettings) validateCheckerNames() error {
	allowedNames := getAllCheckerNames()

	for _, name := range s.EnabledChecks {
		if !allowedNames[strings.ToLower(name)] {
			return fmt.Errorf("enabled checker %s doesn't exist, all existing checkers: %s",
				name, sprintAllowedCheckerNames(allowedNames))
		}
	}

	for _, name := range s.DisabledChecks {
		if !allowedNames[strings.ToLower(name)] {
			return fmt.Errorf("disabled checker %s doesn't exist, all existing checkers: %s",
				name, sprintAllowedCheckerNames(allowedNames))
		}
	}

	return nil
}

func (s *GocriticSettings) GetLowercasedParams() map[string]GocriticCheckSettings {
	ret := map[string]GocriticCheckSettings{}
	for checker, params := range s.SettingsPerCheck {
		ret[strings.ToLower(checker)] = params
	}
	return ret
}
