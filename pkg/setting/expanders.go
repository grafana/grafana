package setting

import (
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"

	"gopkg.in/ini.v1"
)

type Expander interface {
	SetupExpander(file *ini.File) error
	Expand(string) (string, error)
}

type registeredExpander struct {
	name     string
	priority int64
	expander Expander
}

var expanders = []registeredExpander{
	{
		name:     "env",
		priority: -10,
		expander: envExpander{},
	},
	{
		name:     "file",
		priority: -5,
		expander: fileExpander{},
	},
}

func AddExpander(name string, priority int64, e Expander) {
	expanders = append(expanders, registeredExpander{
		name:     name,
		priority: priority,
		expander: e,
	})
}

var regex = regexp.MustCompile(`\$(|__\w+){([^}]+)}`)

// Slightly hacky function to avoid code duplication. If this is eventually called in multiple places, consider refactoring or potentially adding more general helper functions to this package
func GetExpanderRegex() *regexp.Regexp {
	return regex
}

func expandConfig(file *ini.File) error {
	sort.Slice(expanders, func(i, j int) bool {
		return expanders[i].priority < expanders[j].priority
	})

	for _, expander := range expanders {
		err := expander.expander.SetupExpander(file)
		if err != nil {
			return fmt.Errorf("got error during initilazation of expander '%s': %w", expander.name, err)
		}

		for _, section := range file.Sections() {
			for _, key := range section.Keys() {
				updated, err := applyExpander(key.Value(), expander)
				if err != nil {
					return fmt.Errorf("got error while expanding %s.%s with expander '%s': %w",
						section.Name(),
						key.Name(),
						expander.name,
						err)
				}

				key.SetValue(updated)
			}
		}
	}
	return nil
}

func ExpandVar(s string) (string, error) {
	for _, expander := range expanders {
		var err error
		s, err = applyExpander(s, expander)
		if err != nil {
			return "", fmt.Errorf("got error while expanding expander %s: %w", expander.name, err)
		}
	}
	return s, nil
}

func applyExpander(s string, e registeredExpander) (string, error) {
	matches := regex.FindAllStringSubmatch(s, -1)

	for _, match := range matches {
		if len(match) < 3 {
			return "", fmt.Errorf("regex error, got %d results back for match, expected 3", len(match))
		}

		_, isEnv := e.expander.(envExpander)
		if match[1] == "__"+e.name || (match[1] == "" && isEnv) {
			updated, err := e.expander.Expand(match[2])
			if err != nil {
				return "", err
			}

			s = strings.Replace(s, match[0], updated, 1)
		}
	}

	return s, nil
}

type envExpander struct {
}

func (e envExpander) SetupExpander(file *ini.File) error {
	return nil
}

func (e envExpander) Expand(s string) (string, error) {
	envValue := os.Getenv(s)

	// if env variable is hostname and it is empty use os.Hostname as default
	if s == "HOSTNAME" && envValue == "" {
		return os.Hostname()
	}

	return os.Getenv(s), nil
}

type fileExpander struct {
}

func (e fileExpander) SetupExpander(file *ini.File) error {
	return nil
}

func (e fileExpander) Expand(s string) (string, error) {
	_, err := os.Stat(s)
	if err != nil {
		return "", err
	}

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `s` comes from configuration section keys
	f, err := os.ReadFile(s)
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(f)), nil
}
