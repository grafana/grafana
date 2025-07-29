package setting

import (
	"fmt"
	"strings"
	"time"
)

const SectionSeparator = ":"

// default configuration values are applied when
// the configuration is missing from the defaults.ini and the custom override is invalid
var defaults = map[string]any{
	"expressions" + SectionSeparator + "enabled":                          true,
	"expressions" + SectionSeparator + "sql_expression_cell_limit":        int64(100000),
	"expressions" + SectionSeparator + "sql_expression_output_cell_limit": int64(100000),
	"expressions" + SectionSeparator + "sql_expression_timeout":           time.Second * 10,
}

type ConfigProvider interface {
	Get() *Cfg
	GetValue(sectionName string, keyName string) any
}

type OSSConfigProvider struct {
	Cfg   *Cfg
	cache map[string]any
}

func (c *OSSConfigProvider) GetValue(sectionName string, keyName string) any {
	val, ok := c.cache[sectionName+SectionSeparator+keyName]
	if !ok {
		panic(fmt.Sprintf("config value not found: %s:%s", sectionName, keyName))
	}
	return val
}

func (c *OSSConfigProvider) loadValue(sectionName string, keyName string) (any, error) {
	cfg := c.Get()
	section, err := cfg.Raw.GetSection(sectionName)
	if err != nil {
		return nil, fmt.Errorf("invalid config name: %s", sectionName)
	}

	key, err := section.GetKey(keyName)
	if err != nil {
		return nil, fmt.Errorf("invalid config name: %s", keyName)
	}

	defaultVal, ok := defaults[sectionName+SectionSeparator+keyName]
	if !ok {
		return nil, fmt.Errorf("no default value for config name: %s", sectionName+SectionSeparator+keyName)
	}

	switch val := defaultVal.(type) {
	case string:
		return key.MustString(val), nil
	case int64:
		return key.MustInt64(val), nil
	case int:
		return key.MustInt(val), nil
	case bool:
		return key.MustBool(val), nil
	case time.Duration:
		return key.MustDuration(val), nil
	default:
		return val, fmt.Errorf("unsupported type for config value %s %s", sectionName, keyName)
	}
}

func (c *OSSConfigProvider) Get() *Cfg {
	return c.Cfg
}

func (c *OSSConfigProvider) loadCache() error {
	for k := range defaults {
		parts := strings.Split(k, SectionSeparator)
		if len(parts) != 2 {
			return fmt.Errorf("invalid config name: %s", k)
		}
		sectionName := parts[0]
		keyName := parts[1]
		v, err := c.loadValue(sectionName, keyName)
		if err != nil {
			return err
		}
		c.cache[k] = v
	}
	return nil
}

func ProvideService(cfg *Cfg) (*OSSConfigProvider, error) {
	c := OSSConfigProvider{Cfg: cfg, cache: make(map[string]any, len(defaults))}
	// any failures should occur during startup
	if err := c.loadCache(); err != nil {
		return nil, err
	}
	return &c, nil
}
