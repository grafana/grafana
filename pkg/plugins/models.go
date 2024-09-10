package plugins

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/org"
)

const (
	TypeDashboard = "dashboard"

	ActionAppAccess = "plugins.app:access"
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
	Keywords    []string      `json:"keywords"`
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
	return ss == SignatureStatusValid
}

func (ss SignatureStatus) IsInternal() bool {
	return ss == SignatureStatusInternal
}

const (
	SignatureStatusInternal SignatureStatus = "internal" // core plugin, no signature
	SignatureStatusValid    SignatureStatus = "valid"    // signed and accurate MANIFEST
	SignatureStatusInvalid  SignatureStatus = "invalid"  // invalid signature
	SignatureStatusModified SignatureStatus = "modified" // valid signature, but content mismatch
	SignatureStatusUnsigned SignatureStatus = "unsigned" // no MANIFEST file
)

type ReleaseState string

const (
	ReleaseStateAlpha ReleaseState = "alpha"
)

type SignatureType string

const (
	SignatureTypeGrafana     SignatureType = "grafana"
	SignatureTypeCommercial  SignatureType = "commercial"
	SignatureTypeCommunity   SignatureType = "community"
	SignatureTypePrivate     SignatureType = "private"
	SignatureTypePrivateGlob SignatureType = "private-glob"
)

func (s SignatureType) IsValid() bool {
	switch s {
	case SignatureTypeGrafana, SignatureTypeCommercial, SignatureTypeCommunity, SignatureTypePrivate,
		SignatureTypePrivateGlob:
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
	Signature                 SignatureStatus `json:"signature"`
	Module                    string          `json:"module"`
	BaseURL                   string          `json:"baseUrl"`
	Angular                   AngularMeta     `json:"angular"`
	MultiValueFilterOperators bool            `json:"multiValueFilterOperators"`
	LoadingStrategy           LoadingStrategy `json:"loadingStrategy"`
}

type DataSourceDTO struct {
	ID         int64          `json:"id,omitempty"`
	UID        string         `json:"uid,omitempty"`
	Type       string         `json:"type"`
	Name       string         `json:"name"`
	PluginMeta *PluginMetaDTO `json:"meta"`
	URL        string         `json:"url,omitempty"`
	IsDefault  bool           `json:"isDefault"`
	Access     string         `json:"access,omitempty"`
	Preload    bool           `json:"preload"`
	Module     string         `json:"module,omitempty"`
	JSONData   map[string]any `json:"jsonData"`
	ReadOnly   bool           `json:"readOnly"`
	APIVersion string         `json:"apiVersion,omitempty"`

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
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	AliasIDs        []string        `json:"aliasIds,omitempty"`
	Info            Info            `json:"info"`
	HideFromList    bool            `json:"hideFromList"`
	Sort            int             `json:"sort"`
	SkipDataQuery   bool            `json:"skipDataQuery"`
	ReleaseState    string          `json:"state"`
	BaseURL         string          `json:"baseUrl"`
	Signature       string          `json:"signature"`
	Module          string          `json:"module"`
	Angular         AngularMeta     `json:"angular"`
	LoadingStrategy LoadingStrategy `json:"loadingStrategy"`
}

type AppDTO struct {
	ID              string          `json:"id"`
	Path            string          `json:"path"`
	Version         string          `json:"version"`
	Preload         bool            `json:"preload"`
	Angular         AngularMeta     `json:"angular"`
	LoadingStrategy LoadingStrategy `json:"loadingStrategy"`
}

const (
	errorCodeSignatureMissing   ErrorCode = "signatureMissing"
	errorCodeSignatureModified  ErrorCode = "signatureModified"
	errorCodeSignatureInvalid   ErrorCode = "signatureInvalid"
	ErrorCodeFailedBackendStart ErrorCode = "failedBackendStart"
	ErrorAngular                ErrorCode = "angular"
)

type ErrorCode string

type Error struct {
	ErrorCode       `json:"errorCode"`
	PluginID        string          `json:"pluginId,omitempty"`
	SignatureStatus SignatureStatus `json:"status,omitempty"`
	message         string          `json:"-"`
}

type LoadingStrategy string

const (
	LoadingStrategyFetch  LoadingStrategy = "fetch"
	LoadingStrategyScript LoadingStrategy = "script"
)

func (e Error) Error() string {
	if e.message != "" {
		return e.message
	}

	if e.SignatureStatus != "" {
		switch e.SignatureStatus {
		case SignatureStatusInvalid:
			return fmt.Sprintf("plugin '%s' has an invalid signature", e.PluginID)
		case SignatureStatusModified:
			return fmt.Sprintf("plugin '%s' has an modified signature", e.PluginID)
		case SignatureStatusUnsigned:
			return fmt.Sprintf("plugin '%s' has no signature", e.PluginID)
		case SignatureStatusInternal, SignatureStatusValid:
			return ""
		}
	}

	return fmt.Sprintf("plugin '%s' failed: %s", e.PluginID, e.ErrorCode)
}

func (e Error) AsErrorCode() ErrorCode {
	if e.ErrorCode != "" {
		return e.ErrorCode
	}

	switch e.SignatureStatus {
	case SignatureStatusInvalid:
		return errorCodeSignatureInvalid
	case SignatureStatusModified:
		return errorCodeSignatureModified
	case SignatureStatusUnsigned:
		return errorCodeSignatureMissing
	case SignatureStatusInternal, SignatureStatusValid:
		return ""
	}

	return ""
}

func (e *Error) WithMessage(m string) *Error {
	e.message = m
	return e
}

func (e Error) PublicMessage() string {
	switch e.ErrorCode {
	case errorCodeSignatureInvalid:
		return "Invalid plugin signature"
	case errorCodeSignatureModified:
		return "Plugin signature does not match"
	case errorCodeSignatureMissing:
		return "Plugin signature is missing"
	case ErrorCodeFailedBackendStart:
		return "Plugin failed to start"
	case ErrorAngular:
		return "Angular plugins are not supported"
	}

	return "Plugin failed to load"
}

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

// ActionSet is the model for ActionSet in RBAC.
type ActionSet struct {
	Action  string   `json:"action"`
	Actions []string `json:"actions"`
}

type QueryCachingConfig struct {
	Enabled bool  `json:"enabled"`
	TTLMS   int64 `json:"TTLMs"`
}
