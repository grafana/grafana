package setting

import (
	"gopkg.in/ini.v1"
)

type LLMSettings struct {
	Enabled      bool
	OpenAIAPIKey string
}

func (cfg *Cfg) readLLMSettings(iniFile *ini.File) {
	section := cfg.SectionWithEnvOverrides("llms")
	cfg.LLM = LLMSettings{
		Enabled:      section.Key("enabled").MustBool(false),
		OpenAIAPIKey: section.Key("openai_api_key").MustString(""),
	}
}
