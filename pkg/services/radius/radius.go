package radius

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"layeh.com/radius"
	"layeh.com/radius/rfc2865"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	// ErrInvalidCredentials is returned if username and password do not match
	ErrInvalidCredentials = errors.New("invalid username or password")
)

// Service is the interface for the RADIUS service.
type Service interface {
	// Login authenticates the user against the RADIUS server.
	Login(query *login.LoginUserQuery) (*login.ExternalUserInfo, error)
	// User searches for a user (RADIUS doesn't support user lookup, so this is a no-op)
	User(username string) (*login.ExternalUserInfo, error)
	// IsEnabled returns whether RADIUS authentication is enabled
	IsEnabled() bool
}

// Config holds RADIUS configuration
type Config struct {
	Enabled         bool
	Server          string
	Port            int
	Secret          string
	SkipOrgRoleSync bool
	AllowSignUp     bool
	ClassMappings   []*ClassToOrgRole
	TimeoutSeconds  int
}

// ClassToOrgRole maps RADIUS class attributes to Grafana organization roles
type ClassToOrgRole struct {
	Class          string
	OrgId          int64
	OrgRole        org.RoleType
	IsGrafanaAdmin *bool
}

// serviceImpl is the implementation of the RADIUS service
type serviceImpl struct {
	cfg *Config
	log log.Logger
}

// ProvideService creates a new RADIUS service instance.
func ProvideService(cfg *setting.Cfg, ssoSettings ssosettings.Service) Service {
	// Convert setting.RADIUSClassToOrgRole to radius.ClassToOrgRole
	classMappings := make([]*ClassToOrgRole, len(cfg.RADIUSClassMappings))
	for i, mapping := range cfg.RADIUSClassMappings {
		classMappings[i] = &ClassToOrgRole{
			Class:          mapping.Class,
			OrgId:          mapping.OrgId,
			OrgRole:        org.RoleType(mapping.OrgRole),
			IsGrafanaAdmin: mapping.IsGrafanaAdmin,
		}
	}

	config := &Config{
		Enabled:         cfg.RADIUSAuthEnabled,
		Server:          cfg.RADIUSServer,
		Port:            cfg.RADIUSPort,
		Secret:          cfg.RADIUSSecret,
		SkipOrgRoleSync: cfg.RADIUSSkipOrgRoleSync,
		AllowSignUp:     cfg.RADIUSAllowSignup,
		ClassMappings:   classMappings,
		TimeoutSeconds:  cfg.RADIUSTimeoutSeconds,
	}

	svc := &serviceImpl{
		cfg: config,
		log: log.New("radius"),
	}

	// Register as reloadable for SSO settings
	ssoSettings.RegisterReloadable(social.RADIUSProviderName, svc)

	// Load initial settings from SSO settings
	radiusSettings, err := ssoSettings.GetForProvider(context.Background(), social.RADIUSProviderName)
	if err != nil {
		svc.log.Error("Failed to retrieve RADIUS settings from SSO settings service", "error", err)
		return svc
	}

	err = svc.Reload(context.Background(), *radiusSettings)
	if err != nil {
		svc.log.Error("Failed to load RADIUS settings", "error", err)
		return svc
	}

	return svc
}

// Login authenticates a user against the RADIUS server
func (s *serviceImpl) Login(query *login.LoginUserQuery) (*login.ExternalUserInfo, error) {
	if !s.cfg.Enabled {
		return nil, errors.New("RADIUS authentication not enabled")
	}

	if s.cfg.Server == "" || s.cfg.Secret == "" {
		return nil, errors.New("RADIUS server or secret not configured")
	}

	// Create RADIUS packet
	packet := radius.New(radius.CodeAccessRequest, []byte(s.cfg.Secret))
	rfc2865.UserName_SetString(packet, query.Username)
	rfc2865.UserPassword_SetString(packet, query.Password)

	// Set up client
	client := &radius.Client{}

	host := fmt.Sprintf("%s:%d", s.cfg.Server, s.cfg.Port)

	s.log.Debug("Attempting RADIUS authentication", "server", host, "username", query.Username)

	// Send the request with context
	// Default to 10s if not configured or invalid (defensive fallback)
	timeout := s.cfg.TimeoutSeconds
	if timeout <= 0 {
		timeout = 10
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	response, err := client.Exchange(ctx, packet, host)
	if err != nil {
		s.log.Error("RADIUS authentication failed", "error", err, "server", host)
		return nil, ErrInvalidCredentials
	}

	// Check response
	if response.Code != radius.CodeAccessAccept {
		s.log.Debug("RADIUS authentication rejected", "username", query.Username, "code", response.Code)
		return nil, ErrInvalidCredentials
	}

	s.log.Debug("RADIUS authentication successful", "username", query.Username)

	// Extract all Class attributes from response
	// rfc4372 "Additionally - there could be multiple class attributes in a RADIUS packet"
	var classes []string
	for _, attr := range response.Attributes {
		if attr.Type == rfc2865.Class_Type {
			// AVP embeds Attribute; use radius.String to convert Attribute to string
			val := strings.TrimSpace(radius.String(attr.Attribute))
			if val != "" {
				classes = append(classes, val)
			}
		}
	}
	// dedupe classes while preserving order
	seen := make(map[string]struct{})
	deduped := make([]string, 0, len(classes))
	for _, c := range classes {
		if _, ok := seen[c]; ok {
			continue
		}
		seen[c] = struct{}{}
		deduped = append(deduped, c)
	}
	classes = deduped

	// Create external user info
	extUser := &login.ExternalUserInfo{
		AuthModule: login.RADIUSAuthModule,
		AuthId:     query.Username,
		Name:       query.Username, // Use RADIUS username as display name
		Login:      query.Username,
		// Email will default to Login since RADIUS doesn't provide email
		Groups:   classes, // Use classes as groups
		OrgRoles: map[int64]org.RoleType{},
	}

	// If SkipOrgRoleSync is true, return basic user info
	if s.cfg.SkipOrgRoleSync {
		s.log.Debug("Skipping organization role mapping for RADIUS user")
		return extUser, nil
	}

	// Map classes to organization roles using helper to make behavior testable.
	extUser.OrgRoles = map[int64]org.RoleType{}
	for _, c := range classes {
		s.applyClassMapping(extUser, c)
	}

	// Default role if no mappings found
	if len(extUser.OrgRoles) == 0 {
		extUser.OrgRoles[1] = org.RoleViewer
	}

	return extUser, nil
}

// User searches for a user (RADIUS doesn't support user lookup, so this is a no-op)
func (s *serviceImpl) User(username string) (*login.ExternalUserInfo, error) {
	// RADIUS doesn't support user lookup without authentication
	// Return a basic user info for proxy authentication
	extUser := &login.ExternalUserInfo{
		AuthModule: login.RADIUSAuthModule,
		AuthId:     username,
		Name:       username, // Use RADIUS username as display name
		Login:      username,
		// Email will default to Login since RADIUS doesn't provide email
		Groups:   []string{},
		OrgRoles: map[int64]org.RoleType{},
	}

	if !s.cfg.SkipOrgRoleSync {
		extUser.OrgRoles[1] = org.RoleViewer
	}

	return extUser, nil
}

// IsEnabled returns whether RADIUS authentication is enabled
func (s *serviceImpl) IsEnabled() bool {
	return s.cfg.Enabled
}

// Reload reloads the RADIUS configuration from SSO settings
func (s *serviceImpl) Reload(ctx context.Context, settings models.SSOSettings) error {
	cfg := &Config{}
	cfg.Enabled = resolveBool(settings.Settings["enabled"], false)
	cfg.SkipOrgRoleSync = resolveBool(settings.Settings["skip_org_role_sync"], false)
	cfg.AllowSignUp = resolveBool(settings.Settings["allow_sign_up"], true)
	cfg.Server = resolveString(settings.Settings["radius_server"], "")
	cfg.Port = resolveInt(settings.Settings["radius_port"], 1812)
	cfg.Secret = resolveString(settings.Settings["radius_secret"], "")
	cfg.TimeoutSeconds = resolveInt(settings.Settings["radius_timeout_seconds"], 10)
	if cfg.TimeoutSeconds <= 0 || cfg.TimeoutSeconds > 300 {
		cfg.TimeoutSeconds = 10
	}

	classMappings, err := resolveClassMappings(settings.Settings["class_mappings"])
	if err != nil {
		return err
	}
	cfg.ClassMappings = classMappings

	s.cfg = cfg
	return nil
}

// Validate validates the RADIUS settings
func (s *serviceImpl) Validate(ctx context.Context, settings models.SSOSettings, oldSettings models.SSOSettings, requester identity.Requester) error {
	enabled := resolveBool(settings.Settings["enabled"], false)
	s.log.Debug("RADIUS validation", "enabled", enabled)
	if !enabled {
		return nil
	}

	server := resolveString(settings.Settings["radius_server"], "")
	s.log.Debug("RADIUS validation - server check", "server", server)
	if server == "" {
		return fmt.Errorf("RADIUS server is required")
	}

	secret := resolveString(settings.Settings["radius_secret"], "")
	if secret == "" {
		return fmt.Errorf("RADIUS secret is required")
	}

	port := resolveInt(settings.Settings["radius_port"], 1812)
	if port <= 0 || port > 65535 {
		return fmt.Errorf("RADIUS port must be between 1 and 65535")
	}

	timeoutSeconds := resolveInt(settings.Settings["radius_timeout_seconds"], 10)
	if timeoutSeconds <= 0 || timeoutSeconds > 300 { // realistically nobody needs more than a 5 minute timeout
		return fmt.Errorf("RADIUS timeout must be between 1 and 300 seconds")
	}

	_, err := resolveClassMappings(settings.Settings["class_mappings"])
	if err != nil {
		return fmt.Errorf("invalid class mappings: %w", err)
	}

	return nil
}

func resolveBool(input any, defaultValue bool) bool {
	strInput := fmt.Sprintf("%v", input)
	result, err := strconv.ParseBool(strInput)
	if err != nil {
		return defaultValue
	}
	return result
}

func resolveString(input any, defaultValue string) string {
	if input == nil {
		return defaultValue
	}
	if str, ok := input.(string); ok {
		return str
	}
	return fmt.Sprintf("%v", input)
}

func resolveInt(input any, defaultValue int) int {
	if input == nil {
		return defaultValue
	}
	switch v := input.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case string:
		if result, err := strconv.Atoi(v); err == nil {
			return result
		}
	}
	return defaultValue
}

func resolveClassMappings(input any) ([]*ClassToOrgRole, error) {
	if input == nil {
		return nil, nil
	}

	// Handle string input (JSON array as string)
	if str, ok := input.(string); ok {
		if str == "" || str == "[]" {
			return nil, nil
		}

		// Try to parse as JSON array first
		var stringArray []string
		if err := json.Unmarshal([]byte(str), &stringArray); err == nil {
			return parseClassMappingStrings(stringArray)
		}

		// If not JSON, treat as single mapping
		mappings, err := parseClassMappingStrings([]string{str})
		if err != nil {
			return nil, err
		}
		return mappings, nil
	}

	// Handle array input (from UI)
	if arr, ok := input.([]interface{}); ok {
		var strings []string
		for _, item := range arr {
			if str, ok := item.(string); ok {
				strings = append(strings, str)
			}
		}
		return parseClassMappingStrings(strings)
	}

	// Handle direct struct input
	var mappings []*ClassToOrgRole
	inputJson, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}

	if err = json.Unmarshal(inputJson, &mappings); err != nil {
		return nil, err
	}

	return mappings, nil
}

// applyClassMapping applies a single class value to the ExternalUserInfo's OrgRoles
// It chooses the highest-precedence role when multiple mappings target the same OrgId.
func (s *serviceImpl) applyClassMapping(extUser *login.ExternalUserInfo, class string) {
	for _, mapping := range s.cfg.ClassMappings {
		if mapping.Class != class {
			continue
		}

		existing, ok := extUser.OrgRoles[mapping.OrgId]
		if !ok {
			extUser.OrgRoles[mapping.OrgId] = mapping.OrgRole
		} else {
			if !existing.Includes(mapping.OrgRole) && mapping.OrgRole.Includes(existing) {
				extUser.OrgRoles[mapping.OrgId] = mapping.OrgRole
			}
		}

		if mapping.IsGrafanaAdmin != nil && *mapping.IsGrafanaAdmin {
			isAdmin := true
			extUser.IsGrafanaAdmin = &isAdmin
		}
	}
}

// parseClassMappingStrings parses strings in format "class:orgId:role:isGrafanaAdmin"
func parseClassMappingStrings(stringSlice []string) ([]*ClassToOrgRole, error) {
	var mappings []*ClassToOrgRole

	for _, str := range stringSlice {
		if str == "" {
			continue
		}

		parts := strings.Split(str, ":")
		if len(parts) < 3 {
			return nil, fmt.Errorf("invalid class mapping format: %s (expected class:orgId:role[:isGrafanaAdmin])", str)
		}

		orgId, err := strconv.ParseInt(parts[1], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid orgId in class mapping %s: %v", str, err)
		}

		mapping := &ClassToOrgRole{
			Class:   parts[0],
			OrgId:   orgId,
			OrgRole: org.RoleType(parts[2]),
		}

		// Parse optional isGrafanaAdmin field
		if len(parts) > 3 {
			isAdmin, err := strconv.ParseBool(parts[3])
			if err != nil {
				return nil, fmt.Errorf("invalid isGrafanaAdmin in class mapping %s: %v", str, err)
			}
			mapping.IsGrafanaAdmin = &isAdmin
		}

		mappings = append(mappings, mapping)
	}

	return mappings, nil
}
