package pluginstore

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
)

type Plugin struct {
	plugins.JSONData

	FS                plugins.FS
	supportsStreaming bool

	Class plugins.Class

	// App fields
	Parent          *ParentPlugin
	IncludedInAppID string
	DefaultNavURL   string
	Pinned          bool

	// Signature fields
	Signature     plugins.SignatureStatus
	SignatureType plugins.SignatureType
	SignatureOrg  string

	Error *plugins.Error

	// SystemJS fields
	Module  string
	BaseURL string

	Angular plugins.AngularMeta

	ExternalService *auth.ExternalService

	Translations map[string]string
}

func (p Plugin) SupportsStreaming() bool {
	return p.supportsStreaming
}

func (p Plugin) Base() string {
	return p.FS.Base()
}

func (p Plugin) IsApp() bool {
	return p.Type == plugins.TypeApp
}

func (p Plugin) IsCorePlugin() bool {
	return p.Class == plugins.ClassCore
}

func ToGrafanaDTO(p *plugins.Plugin) Plugin {
	supportsStreaming := false
	pc, exists := p.Client()
	if exists && pc != nil && pc.(backend.StreamHandler) != nil {
		supportsStreaming = true
	}

	dto := Plugin{
		FS:                p.FS,
		supportsStreaming: supportsStreaming,
		Class:             p.Class,
		JSONData:          p.JSONData,
		IncludedInAppID:   p.IncludedInAppID,
		DefaultNavURL:     p.DefaultNavURL,
		Pinned:            p.Pinned,
		Signature:         p.Signature,
		SignatureType:     p.SignatureType,
		SignatureOrg:      p.SignatureOrg,
		Error:             p.Error,
		Module:            p.Module,
		BaseURL:           p.BaseURL,
		ExternalService:   p.ExternalService,
		Angular:           p.Angular,
		Translations:      p.Translations,
	}

	if p.Parent != nil {
		dto.Parent = &ParentPlugin{ID: p.Parent.ID}
	}

	return dto
}

type ParentPlugin struct {
	ID string
}
