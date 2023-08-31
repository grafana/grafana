package setting

import (
	"time"
)

func (cfg *Cfg) readVectorSettings() {
	section := cfg.SectionWithEnvOverrides("vector")
	cfg.Vector = VectorSettings{
		Sync:      cfg.readVectorSyncSettings(),
		Store:     cfg.readVectorStoreSettings(section.Key("store_engine").String()),
		Embedding: cfg.readVectorEmbeddingSettings(section.Key("embedding_engine").String()),
	}
}

type VectorSettings struct {
	Sync      VectorSyncSettings
	Store     VectorStoreSettings
	Embedding EmbeddingEngineSettings
}

type VectorSyncSettings struct {
	Enabled  bool
	Interval time.Duration
}

func (cfg *Cfg) readVectorSyncSettings() VectorSyncSettings {
	section := cfg.SectionWithEnvOverrides("vector.sync")
	return VectorSyncSettings{
		Enabled:  section.Key("enabled").MustBool(false),
		Interval: section.Key("interval").MustDuration(time.Minute * 15),
	}
}

type VectorStoreSettings struct {
	Type string

	Qdrant QdrantVectorDBSettings
}

type QdrantVectorDBSettings struct {
	Address string
}

func (cfg *Cfg) readVectorStoreSettings(engine string) VectorStoreSettings {
	settings := VectorStoreSettings{}
	switch engine {
	case "qdrant":
		settings.Type = "qdrant"
		section := cfg.SectionWithEnvOverrides("vector.qdrant")
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

func (cfg *Cfg) readVectorEmbeddingSettings(engine string) EmbeddingEngineSettings {
	settings := EmbeddingEngineSettings{}
	switch engine {
	case "openai":
		section := cfg.SectionWithEnvOverrides("vector.openai")
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
