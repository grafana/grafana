# SCIM Utility

This package provides utility functions for checking SCIM dynamic app platform settings using the `client.K8sHandler`. It allows both the `authimpl` and `saml` packages to check SCIM settings with dynamic configuration support and static fallback.

## API Reference

### SCIMUtil

The main utility struct that provides methods for checking SCIM settings.

```go
type SCIMUtil struct {
    k8sClient client.K8sHandler
    logger    log.Logger
}
```

### Methods

#### NewSCIMUtil
Creates a new SCIMUtil instance.

```go
func NewSCIMUtil(k8sClient client.K8sHandler) *SCIMUtil
```

#### IsUserSyncEnabled
Checks if SCIM user sync is enabled using dynamic configuration with static fallback.

```go
func (s *SCIMUtil) IsUserSyncEnabled(ctx context.Context, orgID int64, staticEnabled bool) bool
```

#### AreNonProvisionedUsersAllowed
Checks if non-provisioned users are allowed using dynamic configuration with static fallback.

```go
func (s *SCIMUtil) AreNonProvisionedUsersAllowed(ctx context.Context, orgID int64, staticAllowed bool) bool
```

**Note**: This field defaults to `false` when not present in the dynamic configuration.

## Usage

### Basic Usage

```go
import (
    "context"
    "github.com/grafana/grafana/pkg/services/apiserver/client"
    "github.com/grafana/grafana/pkg/services/scimutil"
)

// Create a new SCIM utility instance
scimUtil := scimutil.NewSCIMUtil(k8sClient)

// Check if user sync is enabled (with dynamic config support)
userSyncEnabled := scimUtil.IsUserSyncEnabled(ctx, orgID, staticConfig.IsUserProvisioningEnabled)

// Check if non-provisioned users are allowed (with dynamic config support)
nonProvisionedAllowed := scimUtil.AreNonProvisionedUsersAllowed(ctx, orgID, staticConfig.AllowNonProvisionedUsers)
```

### In authimpl Package

The `authimpl` package uses this utility in the `UserSync` struct to check SCIM settings during user provisioning validation:

```go
// In user_sync.go
type UserSync struct {
    // ... other fields ...
    scimUtil     *scim_util.SCIMUtil
    staticConfig *StaticSCIMConfig
}

func (s *UserSync) skipProvisioningValidation(ctx context.Context, currentIdentity *authn.Identity) bool {
    // Use dynamic SCIM settings if available, otherwise fall back to static config
    effectiveUserSyncEnabled := s.isUserProvisioningEnabled
    effectiveAllowNonProvisionedUsers := s.allowNonProvisionedUsers

    if s.scimUtil != nil {
        orgID := currentIdentity.GetOrgID()
        effectiveUserSyncEnabled = s.scimUtil.IsUserSyncEnabled(ctx, orgID, s.staticConfig.IsUserProvisioningEnabled)
        effectiveAllowNonProvisionedUsers = s.scimUtil.AreNonProvisionedUsersAllowed(ctx, orgID, s.staticConfig.AllowNonProvisionedUsers)
    }

    // ... rest of validation logic ...
}
```

### In SAML Package

The SAML package can use this utility to check SCIM settings during authentication:

```go
// In saml package
type SCIMHelper struct {
    scimUtil *scim_util.SCIMUtil
}

func (h *SCIMHelper) CheckUserSyncEnabled(ctx context.Context, orgID int64, staticEnabled bool) bool {
    if h.scimUtil == nil {
        return staticEnabled
    }
    return h.scimUtil.IsUserSyncEnabled(ctx, orgID, staticEnabled)
}
```

## Dynamic Configuration

The utility supports dynamic SCIM configuration through the Kubernetes API. It will:

1. First attempt to fetch SCIM settings from the dynamic configuration (SCIMConfig resource)
2. If dynamic configuration is not available or fails, fall back to static configuration from `config.ini`
3. Log the source of configuration being used for debugging

### Configuration Sources

- **Dynamic**: SCIMConfig resource in Kubernetes (org-specific)
  - Resource name: `default`
  - API Group: `scim.grafana.com/v0alpha1`
  - Kind: `SCIMConfig`
- **Static**: `auth.scim` section in `config.ini` (global)

### SCIMConfig Resource Structure

```yaml
apiVersion: scim.grafana.com/v0alpha1
kind: SCIMConfig
metadata:
  name: default
  namespace: <org-namespace>
spec:
  enableUserSync: true              # Controls user provisioning
  enableGroupSync: false            # Controls group/team provisioning
  allowNonProvisionedUsers: false   # Controls whether non-provisioned users are allowed (optional)
```

## Error Handling

The utility gracefully handles errors and falls back to static configuration when:
- K8s client is not configured
- SCIMConfig resource is not found
- Network errors occur
- Invalid configuration is encountered
- Missing or malformed spec in SCIMConfig resource

All errors are logged for debugging purposes with appropriate log levels:
- `Debug`: Normal operation messages
- `Warn`: Fallback scenarios and non-critical errors
- `Error`: Invalid configuration or unexpected errors

## Implementation Details

This package is designed to work with the open-source Grafana build and does not depend on enterprise-only SCIM API types. It uses a simplified `SCIMConfigSpec` struct that contains only the essential configuration fields:

```go
type SCIMConfigSpec struct {
    EnableUserSync           bool  `json:"enableUserSync"`
    EnableGroupSync          bool  `json:"enableGroupSync"`
    AllowNonProvisionedUsers *bool `json:"allowNonProvisionedUsers,omitempty"`
}
```

The `AllowNonProvisionedUsers` field is optional and defaults to `false` when not present in the configuration.

The utility directly works with Kubernetes unstructured objects and extracts the configuration values without requiring the full SCIM API types.

## Testing

The package includes comprehensive tests covering:
- All combinations of user sync, group sync, and non-provisioned users settings
- Error scenarios and fallback behavior
- Integration scenarios with both dynamic and static configurations
- Mock implementations for the K8s client interface
- Optional field handling for `allowNonProvisionedUsers`

Run tests with:
```bash
go test ./pkg/services/scimutil
``` 