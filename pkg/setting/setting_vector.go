package setting

import (
	"gopkg.in/ini.v1"
)

func (cfg *Cfg) readVectorSettings(iniFile *ini.File) {
	syncSection := cfg.SectionWithEnvOverrides("vector.sync")
	cfg.Vector = VectorSettings{
		SyncEnabled: syncSection.Key("enabled").MustBool(false),
		Store:       cfg.readVectorStoreSettings(iniFile),
		Embedding:   cfg.readVectorEmbeddingSettings(iniFile),
	}
}

type VectorSettings struct {
	SyncEnabled bool
	Store       VectorStoreSettings
	Embedding   EmbeddingEngineSettings
}

type VectorStoreSettings struct {
	Type string

	Qdrant QdrantVectorDBSettings
}

type QdrantVectorDBSettings struct {
	Address string
}

func (cfg *Cfg) readVectorStoreSettings(iniFile *ini.File) VectorStoreSettings {
	section := cfg.SectionWithEnvOverrides("vector.store")
	settings := VectorStoreSettings{}
	switch section.Key("type").MustString("") {
	case "qdrant":
		settings.Type = "qdrant"
		settings.Qdrant = QdrantVectorDBSettings{
			Address: section.Key("address").MustString("localhost:6333"),
		}
	}
	return settings
}

type EmbeddingEngineSettings struct {
	Type string

	OpenAI OpenAIEngineSettings
}

func (cfg *Cfg) readVectorEmbeddingSettings(iniFile *ini.File) EmbeddingEngineSettings {
	section := cfg.SectionWithEnvOverrides("vector.embedding")
	settings := EmbeddingEngineSettings{}
	switch section.Key("type").MustString("") {
	case "openai":
		settings.Type = "openai"
		settings.OpenAI = OpenAIEngineSettings{
			URL:    section.Key("url").MustString("https://api.openai.com"),
			APIKey: section.Key("api_key").String(),
		}
	}
	return settings
}

type OpenAIEngineSettings struct {
	URL    string
	APIKey string
}
