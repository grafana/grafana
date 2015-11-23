package nsq

import (
	"strings"
)

// ConfigFlag wraps a Config and implements the flag.Value interface
type ConfigFlag struct {
	*Config
}

// Set takes a comma separated value and follows the rules in Config.Set
// using the first field as the option key, and the second (if present) as the value
func (c *ConfigFlag) Set(opt string) (err error) {
	parts := strings.SplitN(opt, ",", 2)
	key := parts[0]

	switch len(parts) {
	case 1:
		// default options specified without a value to boolean true
		err = c.Config.Set(key, true)
	case 2:
		err = c.Config.Set(key, parts[1])
	}
	return
}

// String implements the flag.Value interface
func (c *ConfigFlag) String() string {
	return ""
}
