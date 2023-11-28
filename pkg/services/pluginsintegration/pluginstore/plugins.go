package pluginstore

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
)

type Plugin struct {
	plugins.JSONData

	fs                plugins.FS
	supportsStreaming bool

	Class plugins.Class

	// App fields
	IncludedInAppID string
	DefaultNavURL   string
	Pinned          bool

	// Signature fields
	Signature      plugins.SignatureStatus
	SignatureType  plugins.SignatureType
	SignatureOrg   string
	SignatureError *plugins.SignatureError

	// SystemJS fields
	Module  string
	BaseURL string

	AngularDetected bool

	ExternalService *auth.ExternalService
}

func (p Plugin) SupportsStreaming() bool {
	return p.supportsStreaming
}

func (p Plugin) Base() string {
	return p.fs.Base()
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

	return Plugin{
		fs:                p.FS,
		supportsStreaming: supportsStreaming,
		Class:             p.Class,
		JSONData:          p.JSONData,
		IncludedInAppID:   p.IncludedInAppID,
		DefaultNavURL:     p.DefaultNavURL,
		Pinned:            p.Pinned,
		Signature:         p.Signature,
		SignatureType:     p.SignatureType,
		SignatureOrg:      p.SignatureOrg,
		SignatureError:    p.SignatureError,
		Module:            p.Module,
		BaseURL:           p.BaseURL,
		AngularDetected:   p.AngularDetected,
		ExternalService:   p.ExternalService,
	}
}
