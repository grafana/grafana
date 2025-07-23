package scimutil

import (
	"context"
	"errors"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

// SCIMUtil provides utility functions for checking SCIM dynamic app platform settings
type SCIMUtil struct {
	k8sClient client.K8sHandler
	logger    log.Logger
}

// NewSCIMUtil creates a new SCIMUtil instance
func NewSCIMUtil(k8sClient client.K8sHandler) *SCIMUtil {
	return &SCIMUtil{
		k8sClient: k8sClient,
		logger:    log.New("scim.util"),
	}
}

// IsUserSyncEnabled checks if SCIM user sync is enabled using dynamic configuration with static fallback
func (s *SCIMUtil) IsUserSyncEnabled(ctx context.Context, orgID int64, staticEnabled bool) bool {
	if s.k8sClient == nil {
		s.logger.Debug("K8s client not configured, using static SCIM config for user sync")
		return staticEnabled
	}

	dynamicEnabled, dynamicConfigFetched := s.fetchDynamicSCIMSetting(ctx, orgID, "user")

	if dynamicConfigFetched {
		s.logger.Debug("Using dynamic SCIM config for user sync", "orgID", orgID, "enabled", dynamicEnabled)
		return dynamicEnabled
	}

	// Fallback to static config if dynamic config wasn't fetched successfully
	s.logger.Debug("Using static SCIM config for user sync", "orgID", orgID, "enabled", staticEnabled)
	return staticEnabled
}

// AreNonProvisionedUsersAllowed checks if non-provisioned users are allowed using dynamic configuration with static fallback
func (s *SCIMUtil) AreNonProvisionedUsersAllowed(ctx context.Context, orgID int64, staticAllowed bool) bool {
	if s.k8sClient == nil {
		s.logger.Debug("K8s client not configured, using static SCIM config for non-provisioned users")
		return staticAllowed
	}

	dynamicAllowed, dynamicConfigFetched := s.fetchDynamicSCIMSetting(ctx, orgID, "allowNonProvisionedUsers")

	if dynamicConfigFetched {
		s.logger.Debug("Using dynamic SCIM config for user sync", "orgID", orgID, "enabled", dynamicAllowed)
		return dynamicAllowed
	}

	// Fallback to static config if dynamic config wasn't fetched successfully
	s.logger.Debug("Using static SCIM config for user sync", "orgID", orgID, "enabled", staticAllowed)
	return staticAllowed
}

// fetchDynamicSCIMSetting attempts to retrieve a specific dynamic SCIM configuration setting
func (s *SCIMUtil) fetchDynamicSCIMSetting(ctx context.Context, orgID int64, settingType string) (settingEnabled bool, dynamicConfigFetched bool) {
	if s.k8sClient == nil {
		s.logger.Warn("K8s client not configured, dynamic SCIM config lookup skipped", "orgID", orgID, "settingType", settingType)
		return false, false
	}

	scimConfig, err := s.getOrgSCIMConfig(ctx, orgID)
	if err != nil {
		s.logger.Warn("Failed to fetch dynamic SCIMConfig resource, will attempt fallback to static config", "orgID", orgID, "error", err)
		return false, false
	}

	var enabled bool
	switch settingType {
	case "user":
		enabled = scimConfig.EnableUserSync
	case "group":
		enabled = scimConfig.EnableGroupSync
	case "allowNonProvisionedUsers":
		enabled = scimConfig.AllowNonProvisionedUsers
	default:
		s.logger.Error("Invalid setting type provided to fetchDynamicSCIMSetting", "settingType", settingType)
		return false, false
	}

	return enabled, true
}

// getOrgSCIMConfig fetches and converts the SCIMConfig for an org
func (s *SCIMUtil) getOrgSCIMConfig(ctx context.Context, orgID int64) (*SCIMConfigSpec, error) {
	if s.k8sClient == nil {
		return nil, errors.New("k8s client not configured")
	}

	unstructuredObj, err := s.k8sClient.Get(ctx, "default", orgID, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	return s.unstructuredToSCIMConfig(unstructuredObj)
}

// SCIMConfigSpec represents the spec part of a SCIMConfig resource
type SCIMConfigSpec struct {
	EnableUserSync           bool `json:"enableUserSync"`
	EnableGroupSync          bool `json:"enableGroupSync"`
	AllowNonProvisionedUsers bool `json:"allowNonProvisionedUsers"`
}

// unstructuredToSCIMConfig converts an unstructured object to a SCIMConfigSpec
func (s *SCIMUtil) unstructuredToSCIMConfig(obj *unstructured.Unstructured) (*SCIMConfigSpec, error) {
	if obj == nil {
		return nil, errors.New("nil unstructured object")
	}

	// Convert spec
	spec, found, err := unstructured.NestedMap(obj.Object, "spec")
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, errors.New("spec not found in SCIMConfig")
	}

	enableUserSync, _, _ := unstructured.NestedBool(spec, "enableUserSync")
	enableGroupSync, _, _ := unstructured.NestedBool(spec, "enableGroupSync")
	allowNonProvisionedUsers, _, _ := unstructured.NestedBool(spec, "allowNonProvisionedUsers")

	return &SCIMConfigSpec{
		EnableUserSync:           enableUserSync,
		EnableGroupSync:          enableGroupSync,
		AllowNonProvisionedUsers: allowNonProvisionedUsers,
	}, nil
}
