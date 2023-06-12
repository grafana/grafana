package setting

import (
	"gopkg.in/ini.v1"
)

type LLMSettings struct {
	Enabled      bool
	OpenAIAPIKey string

	VectorDB VectorDBSettings
}

func (cfg *Cfg) readLLMSettings(iniFile *ini.File) {
	section := cfg.SectionWithEnvOverrides("llms")
	vectorDBSection := cfg.SectionWithEnvOverrides("llms.vector_db")
	cfg.LLM = LLMSettings{
		Enabled:      section.Key("enabled").MustBool(false),
		OpenAIAPIKey: section.Key("openai_api_key").MustString(""),
		VectorDB: VectorDBSettings{
			Type:    vectorDBSection.Key("type").MustString(""),
			Address: vectorDBSection.Key("address").MustString(""),
		},
	}
}

type VectorDBSettings struct {
	Type    string
	Address string
}
