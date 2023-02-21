package plugins

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/org"
)

const (
	TypeDashboard = "dashboard"
)

var (
	ErrInstallCorePlugin   = errors.New("cannot install a Core plugin")
	ErrUninstallCorePlugin = errors.New("cannot uninstall a Core plugin")
	ErrPluginNotInstalled  = errors.New("plugin is not installed")
)

type NotFoundError struct {
	PluginID string
}

func (e NotFoundError) Error() string {
	return fmt.Sprintf("plugin with ID '%s' not found", e.PluginID)
}

type DuplicateError struct {
	PluginID string
}

func (e DuplicateError) Error() string {
	return fmt.Sprintf("plugin with ID '%s' already exists", e.PluginID)
}

func (e DuplicateError) Is(err error) bool {
	// nolint:errorlint
	_, ok := err.(DuplicateError)
	return ok
}

type SignatureError struct {
	PluginID        string          `json:"pluginId"`
	SignatureStatus SignatureStatus `json:"status"`
}

func (e SignatureError) Error() string {
	switch e.SignatureStatus {
	case SignatureInvalid:
		return fmt.Sprintf("plugin '%s' has an invalid signature", e.PluginID)
	case SignatureModified:
		return fmt.Sprintf("plugin '%s' has an modified signature", e.PluginID)
	case SignatureUnsigned:
		return fmt.Sprintf("plugin '%s' has no signature", e.PluginID)
	case SignatureInternal, SignatureValid:
		return ""
	}

	return fmt.Sprintf("plugin '%s' has an unknown signature state", e.PluginID)
}

func (e SignatureError) AsErrorCode() ErrorCode {
	switch e.SignatureStatus {
	case SignatureInvalid:
		return signatureInvalid
	case SignatureModified:
		return signatureModified
	case SignatureUnsigned:
		return signatureMissing
	case SignatureInternal, SignatureValid:
		return ""
	}

	return ""
}

type Dependencies struct {
	GrafanaDependency string       `json:"grafanaDependency"`
	GrafanaVersion    string       `json:"grafanaVersion"`
	Plugins           []Dependency `json:"plugins"`
}

type Includes struct {
	Name       string       `json:"name"`
	Path       string       `json:"path"`
	Type       string       `json:"type"`
	Component  string       `json:"component"`
	Role       org.RoleType `json:"role"`
	Action     string       `json:"action,omitempty"`
	AddToNav   bool         `json:"addToNav"`
	DefaultNav bool         `json:"defaultNav"`
	Slug       string       `json:"slug"`
	Icon       string       `json:"icon"`
	UID        string       `json:"uid"`

	ID string `json:"-"`
}

func (e Includes) DashboardURLPath() string {
	if e.Type != "dashboard" || len(e.UID) == 0 {
		return ""
	}
	return "/d/" + e.UID
}

func (e Includes) RequiresRBACAction() bool {
	return e.Action != ""
}

type Dependency struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Name    string `json:"name"`
	Version string `json:"version"`
}

type BuildInfo struct {
	Time   int64  `json:"time,omitempty"`
	Repo   string `json:"repo,omitempty"`
	Branch string `json:"branch,omitempty"`
	Hash   string `json:"hash,omitempty"`
}

type Info struct {
	Author      InfoLink      `json:"author"`
	Description string        `json:"description"`
	Links       []InfoLink    `json:"links"`
	Logos       Logos         `json:"logos"`
	Build       BuildInfo     `json:"build"`
	Screenshots []Screenshots `json:"screenshots"`
	Version     string        `json:"version"`
	Updated     string        `json:"updated"`
}

type InfoLink struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type Logos struct {
	Small string `json:"small"`
	Large string `json:"large"`
}

type Screenshots struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

type StaticRoute struct {
	PluginID  string
	Directory string
}

type SignatureStatus string

func (ss SignatureStatus) IsValid() bool {
	return ss == SignatureValid
}

func (ss SignatureStatus) IsInternal() bool {
	return ss == SignatureInternal
}

const (
	SignatureInternal SignatureStatus = "internal" // core plugin, no signature
	SignatureValid    SignatureStatus = "valid"    // signed and accurate MANIFEST
	SignatureInvalid  SignatureStatus = "invalid"  // invalid signature
	SignatureModified SignatureStatus = "modified" // valid signature, but content mismatch
	SignatureUnsigned SignatureStatus = "unsigned" // no MANIFEST file
)

type ReleaseState string

const (
	AlphaRelease ReleaseState = "alpha"
)

type SignatureType string

const (
	GrafanaSignature     SignatureType = "grafana"
	CommercialSignature  SignatureType = "commercial"
	CommunitySignature   SignatureType = "community"
	PrivateSignature     SignatureType = "private"
	PrivateGlobSignature SignatureType = "private-glob"
)

func (s SignatureType) IsValid() bool {
	switch s {
	case GrafanaSignature, CommercialSignature, CommunitySignature, PrivateSignature, PrivateGlobSignature:
		return true
	}
	return false
}

type Signature struct {
	Status     SignatureStatus
	Type       SignatureType
	SigningOrg string
}

type PluginMetaDTO struct {
	JSONData

	Signature SignatureStatus `json:"signature"`

	Module  string `json:"module"`
	BaseURL string `json:"baseUrl"`
}

type DataSourceDTO struct {
	ID         int64                  `json:"id,omitempty"`
	UID        string                 `json:"uid,omitempty"`
	Type       string                 `json:"type"`
	Name       string                 `json:"name"`
	PluginMeta *PluginMetaDTO         `json:"meta"`
	URL        string                 `json:"url,omitempty"`
	IsDefault  bool                   `json:"isDefault"`
	Access     string                 `json:"access,omitempty"`
	Preload    bool                   `json:"preload"`
	Module     string                 `json:"module,omitempty"`
	JSONData   map[string]interface{} `json:"jsonData"`
	ReadOnly   bool                   `json:"readOnly"`

	BasicAuth       string `json:"basicAuth,omitempty"`
	WithCredentials bool   `json:"withCredentials,omitempty"`

	// This is populated by an Enterprise hook
	CachingConfig QueryCachingConfig `json:"cachingConfig,omitempty"`

	// InfluxDB
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`

	// InfluxDB + Elasticsearch
	Database string `json:"database,omitempty"`

	// Prometheus
	DirectURL string `json:"directUrl,omitempty"`
}

type PanelDTO struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Info          Info   `json:"info"`
	HideFromList  bool   `json:"hideFromList"`
	Sort          int    `json:"sort"`
	SkipDataQuery bool   `json:"skipDataQuery"`
	ReleaseState  string `json:"state"`
	BaseURL       string `json:"baseUrl"`
	Signature     string `json:"signature"`
	Module        string `json:"module"`
}

type AppDTO struct {
	ID      string `json:"id"`
	Path    string `json:"path"`
	Version string `json:"version"`
	Preload bool   `json:"preload"`
}

const (
	signatureMissing  ErrorCode = "signatureMissing"
	signatureModified ErrorCode = "signatureModified"
	signatureInvalid  ErrorCode = "signatureInvalid"
)

type ErrorCode string

type Error struct {
	ErrorCode `json:"errorCode"`
	PluginID  string `json:"pluginId,omitempty"`
}

// Access-Control related definitions

// RoleRegistration stores a role and its assignments to basic roles
// (Viewer, Editor, Admin, Grafana Admin)
type RoleRegistration struct {
	Role   Role     `json:"role"`
	Grants []string `json:"grants"`
}

// Role is the model for Role in RBAC.
type Role struct {
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Permissions []Permission `json:"permissions"`
}

type Permission struct {
	Action string `json:"action"`
	Scope  string `json:"scope"`
}

type QueryCachingConfig struct {
	Enabled bool  `json:"enabled"`
	TTLMS   int64 `json:"TTLMs"`
}
