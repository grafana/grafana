# Kubernetes-Style Reconciliation Status and Conditions Proposal

## Executive Summary

This document analyzes the current Grafana provisioning API's reconciliation status patterns for `Repository` and `Connection` resources, compares them with standard Kubernetes practices, and proposes a migration path toward a more idiomatic k8s-style status and conditions design.

**Current State**: Custom status structure with domain-specific fields (Health, Sync, FieldErrors)

**Proposed State**: Standard k8s Conditions array + domain-specific fields for rich data

**Migration Strategy**: Additive approach with backward compatibility

**Key Features**:
- Standard Kubernetes Conditions for reconciliation status (Ready, Healthy, Synced, Validated)
- **Quota enforcement conditions** (`QuotaCompliant`) for tier-based limits on repository count and resources per repository
- **Setup tracking conditions** (`SecretsConfigured`, `WebhookConfigured`) for token and webhook initialization
- Hybrid approach preserving rich domain-specific details
- Clear upgrade path from free to paid tiers via condition-based messaging

---

## Table of Contents

1. [Current Implementation Analysis](#current-implementation-analysis)
2. [Standard Kubernetes Patterns](#standard-kubernetes-patterns)
3. [Gap Analysis](#gap-analysis)
4. [Proposed Design](#proposed-design)
   - [Proposed Condition Types](#proposed-condition-types)
   - [Quota Enforcement for Tier Limits](#quota-enforcement-for-tier-limits)
   - [Secrets and Webhook Setup](#secrets-and-webhook-setup)
5. [Migration Strategy](#migration-strategy)
6. [Implementation Examples](#implementation-examples)
7. [Benefits and Trade-offs](#benefits-and-trade-offs)

---

## Current Implementation Analysis

### Repository Status Structure

```go
type RepositoryStatus struct {
    ObservedGeneration int64          `json:"observedGeneration"`
    FieldErrors        []ErrorDetails  `json:"fieldErrors,omitempty"`
    Health             HealthStatus    `json:"health"`
    Sync               SyncStatus      `json:"sync"`
    Stats              []ResourceCount `json:"stats,omitempty"`
    Webhook            *WebhookStatus  `json:"webhook"`
    Token              TokenStatus     `json:"token,omitempty"`
    DeleteError        string          `json:"deleteError,omitempty"`
}

type HealthStatus struct {
    Healthy bool              `json:"healthy"`
    Error   HealthFailureType `json:"error,omitempty"`
    Checked int64             `json:"checked,omitempty"`
    Message []string          `json:"message,omitempty"`
}

type SyncStatus struct {
    State       JobState `json:"state"`  // pending, working, success, error
    JobID       string   `json:"job,omitempty"`
    Started     int64    `json:"started,omitempty"`
    Finished    int64    `json:"finished,omitempty"`
    Scheduled   int64    `json:"scheduled,omitempty"`
    Message     []string `json:"message"`
    LastRef     string   `json:"lastRef,omitempty"`
    Incremental bool     `json:"incremental,omitempty"`
}
```

### Connection Status Structure

```go
type ConnectionStatus struct {
    ObservedGeneration int64          `json:"observedGeneration"`
    FieldErrors        []ErrorDetails  `json:"fieldErrors,omitempty"`
    State              ConnectionState `json:"state"`  // connected, disconnected
    Health             HealthStatus    `json:"health"`
}
```

### Controller Reconciliation Triggers

The controller processes items when ANY of these conditions are met:

1. **Spec Changed**: `obj.Generation != obj.Status.ObservedGeneration`
2. **Sync Interval Triggered**: `shouldResync` based on `IntervalSeconds`
3. **Health Stale**: Health check older than threshold (5min healthy, 1min unhealthy)

### Status Update Pattern

```go
// Current pattern: Build patch operations in bulk
var patchOperations []map[string]interface{}

// Update observedGeneration
patchOperations = append(patchOperations, map[string]interface{}{
    "op": "replace",
    "path": "/status/observedGeneration",
    "value": obj.Generation,
})

// Update health
patchOperations = append(patchOperations, map[string]interface{}{
    "op": "replace",
    "path": "/status/health",
    "value": healthStatus,
})

// Apply all patches atomically
rc.statusPatcher.Patch(ctx, obj, patchOperations...)
```

### Strengths

✅ **Domain-Specific Clarity**: Fields like `Health`, `Sync`, `Webhook` are clear and purpose-built
✅ **Rich Information**: Extensive status details (timestamps, job IDs, stats, tokens)
✅ **ObservedGeneration**: Proper tracking of reconciliation state
✅ **Atomic Updates**: Batch patch operations minimize API calls
✅ **Field-Level Errors**: `FieldErrors` provides detailed validation feedback
✅ **Intelligent Retry**: Only retries transient errors, fast-fail on permanent errors

### Weaknesses

❌ **Non-Standard Pattern**: Doesn't follow k8s Conditions convention
❌ **Hard to Query**: Tools/UIs expecting standard conditions won't work
❌ **No Condition History**: Can't track state transitions over time
❌ **Multiple Sources of Truth**: Health, Sync, and State fields can conflict
❌ **Limited Observability**: kubectl/k9s won't show meaningful status
❌ **No Standardized Reasons**: Error types are custom, not k8s CamelCase reasons

---

## Standard Kubernetes Patterns

### The Conditions Pattern

Kubernetes APIs use a standard `Conditions` array in status:

```go
type MyResourceStatus struct {
    // Standard k8s generation tracking
    ObservedGeneration int64 `json:"observedGeneration,omitempty"`

    // Standard conditions array
    Conditions []metav1.Condition `json:"conditions,omitempty"`

    // Optional: high-level phase
    Phase string `json:"phase,omitempty"`

    // Domain-specific fields (details beyond conditions)
    // ...
}

// metav1.Condition structure
type Condition struct {
    Type               string      `json:"type"`
    Status             ConditionStatus `json:"status"` // True, False, Unknown
    ObservedGeneration int64       `json:"observedGeneration,omitempty"`
    LastTransitionTime metav1.Time `json:"lastTransitionTime"`
    Reason             string      `json:"reason"`
    Message            string      `json:"message"`
}
```

### Standard Condition Types

Common condition types used across k8s ecosystem:

| Condition Type | Meaning | Status Values |
|----------------|---------|---------------|
| `Ready` | Resource is ready to serve requests | True/False/Unknown |
| `Available` | Resource is available (similar to Ready) | True/False/Unknown |
| `Progressing` | Resource is making progress toward ready state | True/False/Unknown |
| `Degraded` | Resource is operating in degraded mode | True/False/Unknown |
| `Reconciling` | Currently being reconciled | True/False |
| `Stalled` | Reconciliation has stalled | True/False |
| `Validated` | Spec validation passed | True/False |

### Condition Usage Examples

**Deployment Status:**
```yaml
status:
  conditions:
  - type: Available
    status: "True"
    lastTransitionTime: "2024-01-15T10:30:00Z"
    reason: MinimumReplicasAvailable
    message: Deployment has minimum availability.
  - type: Progressing
    status: "True"
    lastTransitionTime: "2024-01-15T10:29:45Z"
    reason: NewReplicaSetAvailable
    message: ReplicaSet "nginx-5b8c7" has successfully progressed.
```

**Certificate (cert-manager) Status:**
```yaml
status:
  conditions:
  - type: Ready
    status: "True"
    lastTransitionTime: "2024-01-15T10:30:00Z"
    reason: CertificateIssued
    message: Certificate is up to date and has not expired
  - type: Issuing
    status: "False"
    lastTransitionTime: "2024-01-15T10:29:50Z"
    reason: Complete
    message: Certificate issued successfully
```

### Controller Pattern

Standard k8s controllers follow this pattern:

```go
func (r *Reconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    // 1. Fetch the resource
    obj := &MyResource{}
    if err := r.Get(ctx, req.NamespacedName, obj); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }

    // 2. Handle deletion (finalizers)
    if !obj.DeletionTimestamp.IsZero() {
        return r.handleDeletion(ctx, obj)
    }

    // 3. Ensure finalizers are present
    if !controllerutil.ContainsFinalizer(obj, myFinalizer) {
        controllerutil.AddFinalizer(obj, myFinalizer)
        return ctrl.Result{}, r.Update(ctx, obj)
    }

    // 4. Reconcile the resource
    result, err := r.reconcile(ctx, obj)

    // 5. Update status with conditions
    meta.SetStatusCondition(&obj.Status.Conditions, metav1.Condition{
        Type:               "Ready",
        Status:             metav1.ConditionTrue,
        ObservedGeneration: obj.Generation,
        LastTransitionTime: metav1.Now(),
        Reason:             "ReconciliationSucceeded",
        Message:            "Resource is ready",
    })

    if err := r.Status().Update(ctx, obj); err != nil {
        return ctrl.Result{}, err
    }

    return result, err
}
```

### Key Principles

1. **Conditions are the source of truth** for resource readiness
2. **ObservedGeneration in conditions** links condition to specific spec version
3. **LastTransitionTime** enables tracking state changes
4. **Reason** is CamelCase, machine-readable
5. **Message** is human-readable explanation
6. **Status values** are standardized: True/False/Unknown

---

## Gap Analysis

### Mapping Current Fields to K8s Patterns

| Current Field | K8s Equivalent | Gap |
|---------------|----------------|-----|
| `Health.Healthy` | `Ready` condition with Status=True/False | Need condition type |
| `Health.Error` | Condition `Reason` field | Need CamelCase reasons |
| `Health.Message` | Condition `Message` field | Need single message vs array |
| `Sync.State` | `Syncing` or `Progressing` condition | Need condition type |
| `Sync.Message` | Condition `Message` | Already compatible |
| `Connection.State` | `Connected` condition | Need condition type |
| `FieldErrors` | `Validated` condition (Status=False) | Can map to condition |
| `ObservedGeneration` | status-level field | ✅ Already present |

### What's Missing

1. **No Conditions Array**: Central issue - no standard condition structure
2. **No Transition Tracking**: Can't see when health/sync state changed
3. **No Condition History**: Lost context of state changes
4. **Non-Standard Reasons**: Error types are domain-specific enums, not k8s CamelCase
5. **Multiple Boolean Flags**: `Healthy`, `Sync.State`, `Connection.State` serve similar purposes

### What's Already Good

1. **ObservedGeneration**: Proper reconciliation tracking ✅
2. **Rich Domain Data**: Stats, Webhook, Token, etc. can remain as-is ✅
3. **Atomic Updates**: Batch patching pattern is excellent ✅
4. **Field Errors**: Detailed validation feedback ✅
5. **Timestamps**: Unix millis in Health/Sync can be preserved ✅

---

## Proposed Design

### Design Philosophy

**Hybrid Approach**: Adopt standard k8s Conditions for reconciliation status while preserving rich domain-specific fields.

**Principles**:
1. Conditions are the **primary source of truth** for reconciliation status
2. Domain-specific fields provide **additional context and details**
3. **Backward compatibility** during migration
4. **Additive changes** - don't break existing consumers

### Proposed Condition Types

#### For Repository

| Condition Type | Status | Reason Examples | Purpose |
|----------------|--------|-----------------|---------|
| `Ready` | True/False/Unknown | `RepositoryReady`, `HealthCheckFailed`, `SyncFailed`, `QuotaExceeded`, `SecretsNotConfigured` | Overall readiness |
| `Healthy` | True/False | `HealthCheckPassed`, `HealthCheckFailed`, `HookFailed`, `ConnectionUnhealthy`, `RepositoryNotFound`, `BranchNotFound`, `InsufficientPermissions` | Health check status including external resource validation |
| `Synced` | True/False/Unknown | `SyncSucceeded`, `SyncFailed`, `SyncInProgress`, `SyncDisabled`, `QuotaExceeded` | Sync job status |
| `Validated` | True/False | `ValidationSucceeded`, `FieldValidationFailed`, `ConnectionNotFound`, `InvalidAppID` | Spec validation (structural and reference checks) |
| `QuotaCompliant` | True/False | `WithinQuota`, `RepositoryCountExceeded`, `ResourceQuotaExceeded` | Quota enforcement for tier limits |
| `SecretsConfigured` | True/False | `SecretsReady`, `TokenPending`, `TokenFailed`, `InvalidInstallationID`, `InstallationDisabled`, `ConnectionNotReady`, `WebhookSecretPending`, `WebhookSecretFailed`, `NotRequired` | Token and webhook secret setup (includes connection dependency failures) |
| `WebhookConfigured` | True/False | `WebhookCreated`, `WebhookFailed`, `WebhookNotRequired`, `SecretNotReady`, `RepositoryNotFound`, `InsufficientPermissions` | Webhook registration with provider |

#### For Connection

| Condition Type | Status | Reason Examples | Purpose |
|----------------|--------|-----------------|---------|
| `Ready` | True/False/Unknown | `Connected`, `Disconnected`, `AuthenticationFailed`, `TokenNotConfigured`, `InstallationDisabled` | Overall readiness |
| `Connected` | True/False | `TestSucceeded`, `TestFailed`, `InvalidCredentials`, `AuthenticationFailed`, `AuthorizationRevoked`, `NetworkUnreachable` | Connection test status |
| `Validated` | True/False | `ValidationSucceeded`, `FieldValidationFailed`, `InvalidURL`, `InvalidAppID`, `InvalidInstallationID` | Spec validation (structural checks) |
| `SecretsConfigured` | True/False | `SecretsReady`, `TokenPending`, `TokenFailed`, `InvalidInstallationID`, `InstallationDisabled`, `NotRequired` | Token setup in secure storage (includes external validation) |

### Quota Enforcement for Tier Limits

A key use case for the provisioning API is enforcing tier-based limits to guide users to upgrade from free to paid plans. Two quota scenarios need to be handled:

#### 1. Repository Count Quota

**Scenario**: A user/organization has exceeded the maximum number of repositories allowed for their tier.

**Behavior**:
- When a new repository is created that would exceed the limit, it should be **accepted** but marked as not ready
- The `QuotaCompliant` condition should be set to `False` with reason `RepositoryCountExceeded`
- The `Ready` condition should be `False` with reason `QuotaExceeded`
- Sync should be **disabled** to prevent resource provisioning
- A clear message should guide users to upgrade their tier

**Implementation**:
```go
// Check repository count during reconciliation
func (rc *RepositoryController) checkRepositoryQuota(ctx context.Context,
    repo *provisioning.Repository) (exceeded bool, message string, err error) {

    // Get user's tier and quota limits
    tier, err := rc.tierService.GetTierForNamespace(ctx, repo.Namespace)
    if err != nil {
        return false, "", err
    }

    // Count existing repositories in the namespace
    repos, err := rc.repoLister.Repositories(repo.Namespace).List(labels.Everything())
    if err != nil {
        return false, "", err
    }

    if len(repos) > tier.MaxRepositories {
        return true, fmt.Sprintf(
            "Repository count (%d) exceeds the limit (%d) for %s tier. Upgrade to increase limit.",
            len(repos), tier.MaxRepositories, tier.Name,
        ), nil
    }

    return false, "", nil
}
```

#### 2. Resource Quota per Repository

**Scenario**: A single repository manages more than N resources (dashboards, datasources, etc.), exceeding the per-repository limit for the user's tier.

**Behavior**:
- The repository was previously syncing successfully
- After a sync job completes, the controller detects that `Stats` show > N resources
- The `QuotaCompliant` condition should be set to `False` with reason `ResourceQuotaExceeded`
- The `Synced` condition should be `False` with reason `QuotaExceeded`
- Future syncs should be **blocked** to prevent adding more resources
- A clear message should guide users to either reduce resources or upgrade

**Implementation**:
```go
// Check resource quota after sync completes
func (rc *RepositoryController) checkResourceQuota(ctx context.Context,
    repo *provisioning.Repository) (exceeded bool, message string, err error) {

    // Get user's tier and quota limits
    tier, err := rc.tierService.GetTierForNamespace(ctx, repo.Namespace)
    if err != nil {
        return false, "", err
    }

    // Count total resources from Stats
    totalResources := 0
    for _, stat := range repo.Status.Stats {
        totalResources += int(stat.Count)
    }

    if totalResources > tier.MaxResourcesPerRepository {
        return true, fmt.Sprintf(
            "Repository manages %d resources, exceeding the limit (%d) for %s tier. "+
            "Reduce resources or upgrade to continue syncing.",
            totalResources, tier.MaxResourcesPerRepository, tier.Name,
        ), nil
    }

    return false, "", nil
}
```

#### Quota Condition Logic

```go
func (r *RepositoryReconciler) updateQuotaCompliantCondition(
    repo *provisioning.Repository,
    repoCountExceeded bool,
    resourceQuotaExceeded bool,
    quotaMessage string) {

    var condition metav1.Condition

    switch {
    case repoCountExceeded:
        condition = metav1.Condition{
            Type:               "QuotaCompliant",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "RepositoryCountExceeded",
            Message:            quotaMessage,
        }

    case resourceQuotaExceeded:
        condition = metav1.Condition{
            Type:               "QuotaCompliant",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "ResourceQuotaExceeded",
            Message:            quotaMessage,
        }

    default:
        condition = metav1.Condition{
            Type:               "QuotaCompliant",
            Status:             metav1.ConditionTrue,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "WithinQuota",
            Message:            "Repository is within quota limits",
        }
    }

    meta.SetStatusCondition(&repo.Status.Conditions, condition)
}
```

#### Quota Check Placement in Reconciliation Loop

Quota checks should happen at specific points in the reconciliation flow:

1. **Repository Count Check**: Early in reconciliation, before health checks
   - If exceeded, skip health checks and sync
   - Set QuotaCompliant=False and Ready=False immediately

2. **Resource Count Check**: After sync completes successfully
   - Examine `Stats` field from sync results
   - If exceeded, mark QuotaCompliant=False and Synced=False
   - Future reconciliations should skip sync if quota exceeded

```go
func (rc *RepositoryController) process(item *queueItem) error {
    // ... fetch from cache ...

    // 1. EARLY: Check repository count quota
    repoCountExceeded, quotaMsg, err := rc.checkRepositoryQuota(ctx, obj)
    if err != nil {
        return err
    }

    if repoCountExceeded {
        // Set conditions and exit early
        rc.updateQuotaCompliantCondition(obj, true, false, quotaMsg)
        rc.updateReadyCondition(obj, /* ... */)  // Will be False due to quota
        return rc.statusPatcher.Patch(ctx, obj, patchOperations...)
    }

    // 2. Continue with normal reconciliation
    // ... health checks, sync, etc. ...

    // 3. AFTER SYNC: Check resource quota
    if syncCompleted {
        resourceQuotaExceeded, resourceQuotaMsg, err := rc.checkResourceQuota(ctx, obj)
        if err != nil {
            return err
        }

        if resourceQuotaExceeded {
            rc.updateQuotaCompliantCondition(obj, false, true, resourceQuotaMsg)
            rc.updateSyncCondition(obj, /* mark as failed due to quota */)
            // Sync condition will be False with reason QuotaExceeded
        } else {
            rc.updateQuotaCompliantCondition(obj, false, false, "")
        }
    }

    // ... update all conditions and status ...
}
```

### Secrets and Webhook Setup

During reconciliation, the controller needs to set up secure secrets and external resources. These setup steps must complete before the repository/connection can be considered ready.

#### Repository Setup Requirements

A Repository may need to set up the following during reconciliation:

1. **Token Secret** (when using a Connection):
   - Repository references a Connection for authentication
   - Controller must generate/obtain a token from the Connection
   - Token is stored in the secure values storage
   - Required for health checks and sync operations
   - **Can fail if**:
     - Connection doesn't exist
     - Connection's `SecretsConfigured` is False (Connection not ready)
     - Connection's `Connected` is False (can't authenticate)
     - GitHub App installation disabled/suspended
     - OAuth app revoked/suspended

2. **Webhook Secret**:
   - Random secret generated for webhook validation
   - Stored in secure values storage
   - Used to verify webhook payloads from the git provider
   - **Can fail if**:
     - Secure storage service unavailable
     - Permissions issues writing to secure storage

3. **Webhook Registration**:
   - Register webhook with the git provider (GitHub, GitLab, etc.)
   - Provides webhook URL and subscribes to events
   - Depends on webhook secret being configured first
   - **Can fail if**:
     - Webhook secret not ready
     - Repository doesn't exist on provider
     - Insufficient permissions (not admin on repo)
     - Provider API unavailable
     - Network issues

#### Connection Setup Requirements

A Connection needs to set up:

1. **Token in Secure Storage**:
   - Private key (for GitHub Apps) or OAuth tokens
   - Stored in the secure values section
   - Required for connection test and repository operations
   - **Can fail if**:
     - Secure storage service unavailable
     - Invalid credentials provided in spec.secure section
     - Permissions issues writing to secure storage

#### External Resource Validation Failures

Beyond basic spec validation, the controller performs external validation when setting up or testing resources. These failures are typically discovered during health checks or setup phases:

**Repository External Validation**:
1. **Repository doesn't exist on provider**:
   - GitHub/GitLab/Bitbucket repo URL is invalid or repo was deleted
   - Results in `Healthy=False` with reason `RepositoryNotFound`
   - Message should include the repo URL/path

2. **Branch doesn't exist**:
   - Specified branch in spec is invalid or was deleted
   - Results in `Healthy=False` with reason `BranchNotFound`
   - Message should include branch name

3. **Insufficient permissions**:
   - Token doesn't have required permissions (read, write, webhook management)
   - Results in `Healthy=False` with reason `InsufficientPermissions`
   - Different from auth failure (valid token, wrong permissions)

**Connection External Validation**:
1. **GitHub App ID invalid**:
   - App ID doesn't exist or is malformed
   - Results in `Validated=False` with reason `InvalidAppID`
   - Detected early during spec validation or setup

2. **Installation ID invalid**:
   - Installation ID doesn't exist or doesn't match the App ID
   - Results in `SecretsConfigured=False` with reason `InvalidInstallationID`
   - Detected when trying to generate token

3. **Installation disabled/suspended**:
   - GitHub App installation was suspended or disabled by the user
   - Results in `SecretsConfigured=False` with reason `InstallationDisabled`
   - May include provider message (e.g., "Installation suspended by administrator")

4. **OAuth app revoked**:
   - User revoked OAuth authorization
   - Results in `Connected=False` with reason `AuthorizationRevoked`
   - Detected during connection test

#### Validation vs Health vs Secrets

It's important to distinguish which condition tracks which type of failure:

| Failure Type | Condition | Reason | When Detected |
|--------------|-----------|--------|---------------|
| Spec field missing/invalid | `Validated=False` | `FieldValidationFailed` | Admission, early reconciliation |
| Connection doesn't exist | `Validated=False` | `ConnectionNotFound` | Early reconciliation |
| App ID format invalid | `Validated=False` | `InvalidAppID` | Early reconciliation |
| Connection not ready | `SecretsConfigured=False` | `TokenPending` | Setup phase |
| Installation ID invalid | `SecretsConfigured=False` | `InvalidInstallationID` | Setup phase (token generation) |
| Installation disabled | `SecretsConfigured=False` | `InstallationDisabled` | Setup phase (token generation) |
| Token generation fails | `SecretsConfigured=False` | `TokenFailed` | Setup phase |
| Repository doesn't exist | `Healthy=False` | `RepositoryNotFound` | Health check phase |
| Branch doesn't exist | `Healthy=False` | `BranchNotFound` | Health check phase |
| Insufficient permissions | `Healthy=False` | `InsufficientPermissions` | Health check phase |
| Auth credentials invalid | `Connected=False` | `AuthenticationFailed` | Connection test |
| OAuth revoked | `Connected=False` | `AuthorizationRevoked` | Connection test |

**Why this distinction matters**:
- **Validated**: Spec is structurally valid, all references exist
- **SecretsConfigured**: We can obtain and store credentials
- **Connected**: Credentials work for authentication
- **Healthy**: Resource exists and is accessible with proper permissions

#### SecretsConfigured Condition

The `SecretsConfigured` condition tracks whether all required secrets have been successfully created and stored.

**For Repository**:
```go
func (rc *RepositoryController) updateSecretsConfiguredCondition(
    repo *provisioning.Repository,
    tokenConfigured bool,
    webhookSecretConfigured bool,
    conn *provisioning.Connection,  // Referenced connection (if any)
    err error) {

    var condition metav1.Condition

    // Determine if secrets are required
    requiresToken := repo.Spec.Connection != nil
    requiresWebhookSecret := repo.requiresWebhook()  // Based on workflows, provider, etc.

    switch {
    case requiresToken && conn != nil && !meta.IsStatusConditionTrue(conn.Status.Conditions, "Connected"):
        // Connection exists but isn't ready
        condition = metav1.Condition{
            Type:               "SecretsConfigured",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "ConnectionNotReady",
            Message:            fmt.Sprintf("Connection %s is not ready", repo.Spec.Connection.Name),
        }

    case err != nil:
        // Failed to configure secrets - determine specific reason from error
        reason, message := categorizeSecretError(err)
        condition = metav1.Condition{
            Type:               "SecretsConfigured",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             reason,  // TokenFailed, InvalidInstallationID, InstallationDisabled, etc.
            Message:            message,
        }

    case requiresToken && !tokenConfigured:
        condition = metav1.Condition{
            Type:               "SecretsConfigured",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "TokenPending",
            Message:            "Waiting for token from connection",
        }

    case requiresWebhookSecret && !webhookSecretConfigured:
        condition = metav1.Condition{
            Type:               "SecretsConfigured",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "WebhookSecretPending",
            Message:            "Generating webhook secret",
        }

    case !requiresToken && !requiresWebhookSecret:
        // No secrets needed
        condition = metav1.Condition{
            Type:               "SecretsConfigured",
            Status:             metav1.ConditionTrue,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "NotRequired",
            Message:            "No secrets required for this repository",
        }

    default:
        // All required secrets are configured
        condition = metav1.Condition{
            Type:               "SecretsConfigured",
            Status:             metav1.ConditionTrue,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "SecretsReady",
            Message:            "All required secrets are configured",
        }
    }

    meta.SetStatusCondition(&repo.Status.Conditions, condition)
}

// categorizeSecretError maps errors to specific condition reasons
func categorizeSecretError(err error) (reason string, message string) {
    message = err.Error()

    // Check error types/messages to determine specific reason
    switch {
    case errors.Is(err, ErrInstallationNotFound):
        return "InvalidInstallationID", fmt.Sprintf("GitHub App installation not found: %v", err)
    case errors.Is(err, ErrInstallationSuspended):
        return "InstallationDisabled", fmt.Sprintf("GitHub App installation is suspended: %v", err)
    case errors.Is(err, ErrAppNotFound):
        return "InvalidAppID", fmt.Sprintf("GitHub App not found: %v", err)
    case errors.Is(err, ErrOAuthRevoked):
        return "AuthorizationRevoked", fmt.Sprintf("OAuth authorization was revoked: %v", err)
    default:
        return "TokenFailed", fmt.Sprintf("Failed to configure token: %v", err)
    }
}
```

**For Connection**:
```go
func (cc *ConnectionController) updateSecretsConfiguredCondition(
    conn *provisioning.Connection,
    tokenConfigured bool,
    err error) {

    var condition metav1.Condition

    switch {
    case err != nil:
        // Failed to configure secrets - determine specific reason from error
        reason, message := categorizeSecretError(err)
        condition = metav1.Condition{
            Type:               "SecretsConfigured",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: conn.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             reason,  // TokenFailed, InvalidInstallationID, InstallationDisabled, etc.
            Message:            message,
        }

    case !tokenConfigured:
        condition = metav1.Condition{
            Type:               "SecretsConfigured",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: conn.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "TokenPending",
            Message:            "Token configuration in progress",
        }

    default:
        condition = metav1.Condition{
            Type:               "SecretsConfigured",
            Status:             metav1.ConditionTrue,
            ObservedGeneration: conn.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "SecretsReady",
            Message:            "Token is configured",
        }
    }

    meta.SetStatusCondition(&conn.Status.Conditions, condition)
}
```

#### WebhookConfigured Condition

The `WebhookConfigured` condition tracks webhook registration with the git provider.

```go
func (rc *RepositoryController) updateWebhookConfiguredCondition(
    repo *provisioning.Repository,
    webhookCreated bool,
    webhookID int64,
    secretsReady bool,
    err error) {

    var condition metav1.Condition

    requiresWebhook := repo.requiresWebhook()

    switch {
    case !requiresWebhook:
        condition = metav1.Condition{
            Type:               "WebhookConfigured",
            Status:             metav1.ConditionTrue,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "WebhookNotRequired",
            Message:            "Webhook not required for this repository configuration",
        }

    case !secretsReady:
        // Can't create webhook without secret
        condition = metav1.Condition{
            Type:               "WebhookConfigured",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "SecretNotReady",
            Message:            "Waiting for webhook secret to be configured",
        }

    case err != nil:
        condition = metav1.Condition{
            Type:               "WebhookConfigured",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "WebhookFailed",
            Message:            fmt.Sprintf("Failed to register webhook: %v", err),
        }

    case webhookCreated:
        condition = metav1.Condition{
            Type:               "WebhookConfigured",
            Status:             metav1.ConditionTrue,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "WebhookCreated",
            Message:            fmt.Sprintf("Webhook registered with ID %d", webhookID),
        }

    default:
        condition = metav1.Condition{
            Type:               "WebhookConfigured",
            Status:             metav1.ConditionUnknown,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "Reconciling",
            Message:            "Webhook setup in progress",
        }
    }

    meta.SetStatusCondition(&repo.Status.Conditions, condition)
}
```

#### Setup Order in Reconciliation Loop

Setup steps must happen in a specific order:

```go
func (rc *RepositoryController) process(item *queueItem) error {
    // ... fetch from cache, check quota ...

    // 1. SETUP PHASE: Configure secrets
    tokenConfigured, webhookSecretConfigured, err := rc.setupSecrets(ctx, obj)
    rc.updateSecretsConfiguredCondition(obj, tokenConfigured, webhookSecretConfigured, err)

    if err != nil || !tokenConfigured {
        // Can't proceed without token
        rc.updateReadyCondition(obj, /* ... */)  // Will be False
        return rc.statusPatcher.Patch(ctx, obj, patchOperations...)
    }

    // 2. SETUP PHASE: Configure webhook (depends on secrets)
    secretsReady := tokenConfigured && webhookSecretConfigured
    webhookCreated, webhookID, err := rc.setupWebhook(ctx, obj, secretsReady)
    rc.updateWebhookConfiguredCondition(obj, webhookCreated, webhookID, secretsReady, err)

    // 3. Continue with health checks (now that setup is complete)
    // ... health checks ...

    // 4. Continue with sync
    // ... sync ...
}
```

**Key Dependencies**:
1. Token must be configured before health checks (needs auth)
2. Webhook secret must exist before creating webhook
3. Webhook creation can fail transiently (provider API issues)
4. Setup should be idempotent (safe to retry)

### Proposed Status Structures

#### Repository Status (New)

```go
type RepositoryStatus struct {
    // Standard k8s fields
    ObservedGeneration int64              `json:"observedGeneration"`
    Conditions         []metav1.Condition `json:"conditions,omitempty"`

    // Domain-specific fields (PRESERVED)
    // These provide rich details beyond what conditions offer
    Health  HealthStatusDetails `json:"health"`   // Renamed for clarity
    Sync    SyncStatusDetails   `json:"sync"`     // Renamed for clarity
    Stats   []ResourceCount     `json:"stats,omitempty"`
    Webhook *WebhookStatus      `json:"webhook"`
    Token   TokenStatus         `json:"token,omitempty"`

    // Deprecated (keep for backward compatibility, remove in v1)
    FieldErrors []ErrorDetails `json:"fieldErrors,omitempty"`  // Replaced by Validated condition
    DeleteError string         `json:"deleteError,omitempty"`  // Use events instead
}

// Renamed to emphasize these are details, not the source of truth
type HealthStatusDetails struct {
    Checked         int64    `json:"checked,omitempty"`          // Last check timestamp
    Message         []string `json:"message,omitempty"`          // Detailed messages
    TestResults     []TestResult `json:"testResults,omitempty"`  // Individual test outcomes
}

type SyncStatusDetails struct {
    JobID       string `json:"jobID,omitempty"`       // Current/last job ID
    Started     int64  `json:"started,omitempty"`     // Job start time
    Finished    int64  `json:"finished,omitempty"`    // Job finish time
    Scheduled   int64  `json:"scheduled,omitempty"`   // Next scheduled sync
    LastRef     string `json:"lastRef,omitempty"`     // Last synced ref
    Incremental bool   `json:"incremental,omitempty"` // Was incremental sync
}
```

#### Connection Status (New)

```go
type ConnectionStatus struct {
    // Standard k8s fields
    ObservedGeneration int64              `json:"observedGeneration"`
    Conditions         []metav1.Condition `json:"conditions,omitempty"`

    // Domain-specific details (PRESERVED)
    Health HealthStatusDetails `json:"health"`

    // Deprecated (keep for backward compatibility, remove in v1)
    State       ConnectionState `json:"state"`       // Replaced by Connected condition
    FieldErrors []ErrorDetails  `json:"fieldErrors,omitempty"`  // Replaced by Validated condition
}
```

### Condition Setting Logic

#### Handling Multiple Failures in Ready Condition

The `Ready` condition is an **aggregate condition** that summarizes the overall state. When multiple issues exist, there are two approaches:

**Approach 1: Priority-based (Recommended)**
- Show the FIRST blocking issue based on priority order
- Users check individual conditions (Validated, SecretsConfigured, Healthy) for ALL issues
- This is the standard Kubernetes pattern

**Approach 2: Aggregate with summary**
- Use a generic reason like "NotReady"
- Message lists all failing conditions
- Provides complete picture but reason is less specific

This proposal recommends **Approach 1 with enhanced messages** that reference other failing conditions when relevant.

#### Repository Ready Condition Logic

```go
func (r *RepositoryReconciler) updateReadyCondition(repo *provisioning.Repository,
    healthStatus HealthStatus, syncStatus SyncStatus, validationErrors []ErrorDetails,
    quotaExceeded bool, quotaMessage string,
    secretsConfigured bool, secretsMessage string) {

    var readyCondition metav1.Condition

    // Collect all failing conditions for enhanced messaging
    var failingConditions []string
    if quotaExceeded {
        failingConditions = append(failingConditions, "QuotaCompliant=False")
    }
    if len(validationErrors) > 0 {
        failingConditions = append(failingConditions, "Validated=False")
    }
    if !secretsConfigured {
        failingConditions = append(failingConditions, "SecretsConfigured=False")
    }
    if !healthStatus.Healthy {
        failingConditions = append(failingConditions, "Healthy=False")
    }
    if repo.Spec.Sync.Enabled && syncStatus.State == provisioning.JobStateError {
        failingConditions = append(failingConditions, "Synced=False")
    }

    // Priority order for determining Ready status
    // Note: Only the FIRST matching case is used, but message may reference others
    switch {
    case quotaExceeded:
        // HIGHEST PRIORITY: Quota exceeded prevents repository from being ready
        message := quotaMessage
        if len(failingConditions) > 1 {
            message += fmt.Sprintf(" (also: %s)", strings.Join(failingConditions[1:], ", "))
        }
        readyCondition = metav1.Condition{
            Type:               "Ready",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "QuotaExceeded",
            Message:            message,
        }

    case len(validationErrors) > 0:
        message := fmt.Sprintf("%d validation error(s)", len(validationErrors))
        if len(failingConditions) > 1 {
            message += fmt.Sprintf(" (also: %s)", strings.Join(failingConditions[1:], ", "))
        }
        readyCondition = metav1.Condition{
            Type:               "Ready",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "ValidationFailed",
            Message:            message,
        }

    case !secretsConfigured:
        // Secrets must be configured before health checks and sync
        message := secretsMessage
        if len(failingConditions) > 1 {
            message += fmt.Sprintf(" (also: %s)", strings.Join(failingConditions[1:], ", "))
        }
        readyCondition = metav1.Condition{
            Type:               "Ready",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "SecretsNotConfigured",
            Message:            message,
        }

    case !healthStatus.Healthy:
        message := strings.Join(healthStatus.Message, "; ")
        if len(failingConditions) > 1 {
            message += fmt.Sprintf(" (also: %s)", strings.Join(failingConditions[1:], ", "))
        }
        readyCondition = metav1.Condition{
            Type:               "Ready",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "HealthCheckFailed",
            Message:            message,
        }

    case repo.Spec.Sync.Enabled && syncStatus.State == provisioning.JobStateError:
        readyCondition = metav1.Condition{
            Type:               "Ready",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "SyncFailed",
            Message:            strings.Join(syncStatus.Message, "; "),
        }

    case healthStatus.Healthy && (!repo.Spec.Sync.Enabled ||
         syncStatus.State == provisioning.JobStateSuccess):
        readyCondition = metav1.Condition{
            Type:               "Ready",
            Status:             metav1.ConditionTrue,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "RepositoryReady",
            Message:            "Repository is healthy and synced",
        }

    default:
        readyCondition = metav1.Condition{
            Type:               "Ready",
            Status:             metav1.ConditionUnknown,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "Reconciling",
            Message:            "Repository reconciliation in progress",
        }
    }

    meta.SetStatusCondition(&repo.Status.Conditions, readyCondition)
}
```

**How this works**:

1. **Reason** shows the PRIMARY blocking issue (highest priority)
2. **Message** includes the primary issue details PLUS a summary of other failing conditions
3. **Individual conditions** still contain full details of each specific failure

**Example with multiple failures**:
```yaml
conditions:
- type: Ready
  status: "False"
  reason: ValidationFailed
  message: "2 validation error(s) (also: SecretsConfigured=False, Healthy=False)"
- type: Validated
  status: "False"
  reason: FieldValidationFailed
  message: "Validation failed for fields: spec.connection, spec.github.appID"
- type: SecretsConfigured
  status: "False"
  reason: ConnectionNotReady
  message: "Connection my-github-app is not ready"
- type: Healthy
  status: "False"
  reason: RepositoryNotFound
  message: "Repository not found: myorg/deleted-repo"
```

**User workflow**:
1. See `Ready=False` with reason `ValidationFailed` - know validation is the top priority
2. See message mentions other issues - know there are multiple problems
3. Check individual conditions to see all details
4. Fix validation errors first (highest priority)
5. Once fixed, controller will surface the next blocking issue automatically

#### Health Condition

```go
func (r *RepositoryReconciler) updateHealthCondition(repo *provisioning.Repository,
    healthStatus HealthStatus) {

    var condition metav1.Condition

    if healthStatus.Healthy {
        condition = metav1.Condition{
            Type:               "Healthy",
            Status:             metav1.ConditionTrue,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "HealthCheckPassed",
            Message:            "Health check passed successfully",
        }
    } else {
        reason := "HealthCheckFailed"
        if healthStatus.Error == provisioning.HealthFailureHook {
            reason = "HookFailed"
        }

        condition = metav1.Condition{
            Type:               "Healthy",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             reason,
            Message:            strings.Join(healthStatus.Message, "; "),
        }
    }

    meta.SetStatusCondition(&repo.Status.Conditions, condition)

    // Also update Health details for rich information
    repo.Status.Health = HealthStatusDetails{
        Checked: healthStatus.Checked,
        Message: healthStatus.Message,
    }
}
```

#### Sync Condition

```go
func (r *RepositoryReconciler) updateSyncCondition(repo *provisioning.Repository,
    syncStatus SyncStatus) {

    if !repo.Spec.Sync.Enabled {
        meta.SetStatusCondition(&repo.Status.Conditions, metav1.Condition{
            Type:               "Synced",
            Status:             metav1.ConditionTrue,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "SyncDisabled",
            Message:            "Sync is disabled for this repository",
        })
        return
    }

    var condition metav1.Condition

    switch syncStatus.State {
    case provisioning.JobStateSuccess:
        condition = metav1.Condition{
            Type:               "Synced",
            Status:             metav1.ConditionTrue,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "SyncSucceeded",
            Message:            fmt.Sprintf("Last sync completed at %s", time.UnixMilli(syncStatus.Finished)),
        }

    case provisioning.JobStateError:
        condition = metav1.Condition{
            Type:               "Synced",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "SyncFailed",
            Message:            strings.Join(syncStatus.Message, "; "),
        }

    case provisioning.JobStateWorking:
        condition = metav1.Condition{
            Type:               "Synced",
            Status:             metav1.ConditionUnknown,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "SyncInProgress",
            Message:            fmt.Sprintf("Sync job %s is running", syncStatus.JobID),
        }

    case provisioning.JobStatePending:
        condition = metav1.Condition{
            Type:               "Synced",
            Status:             metav1.ConditionUnknown,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "SyncPending",
            Message:            "Sync job is queued",
        }
    }

    meta.SetStatusCondition(&repo.Status.Conditions, condition)

    // Also update Sync details for rich information
    repo.Status.Sync = SyncStatusDetails{
        JobID:       syncStatus.JobID,
        Started:     syncStatus.Started,
        Finished:    syncStatus.Finished,
        Scheduled:   syncStatus.Scheduled,
        LastRef:     syncStatus.LastRef,
        Incremental: syncStatus.Incremental,
    }
}
```

#### Validation Condition

```go
func (r *RepositoryReconciler) updateValidatedCondition(repo *provisioning.Repository,
    fieldErrors []ErrorDetails) {

    if len(fieldErrors) == 0 {
        meta.SetStatusCondition(&repo.Status.Conditions, metav1.Condition{
            Type:               "Validated",
            Status:             metav1.ConditionTrue,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "ValidationSucceeded",
            Message:            "All fields validated successfully",
        })
    } else {
        // Collect field paths for summary
        fields := make([]string, len(fieldErrors))
        for i, err := range fieldErrors {
            fields[i] = err.Field
        }

        meta.SetStatusCondition(&repo.Status.Conditions, metav1.Condition{
            Type:               "Validated",
            Status:             metav1.ConditionFalse,
            ObservedGeneration: repo.Generation,
            LastTransitionTime: metav1.Now(),
            Reason:             "FieldValidationFailed",
            Message:            fmt.Sprintf("Validation failed for fields: %s", strings.Join(fields, ", ")),
        })

        // Keep FieldErrors for detailed feedback (deprecated but useful)
        repo.Status.FieldErrors = fieldErrors
    }
}
```

---

## Migration Strategy

### Phase 1: Additive Changes (v0alpha1 → v0alpha2)

**Goal**: Add Conditions without breaking existing consumers

1. **Add Conditions field** to status structs
2. **Populate both** old and new fields during reconciliation
3. **Deprecate** old fields in documentation (keep in API)
4. **Update controllers** to set conditions alongside existing fields
5. **Add conversion webhooks** if using multiple versions

```go
// v0alpha2 status (backward compatible)
type RepositoryStatus struct {
    ObservedGeneration int64              `json:"observedGeneration"`
    Conditions         []metav1.Condition `json:"conditions,omitempty"`  // NEW

    // Deprecated: Use Conditions with type=Validated instead
    FieldErrors []ErrorDetails `json:"fieldErrors,omitempty"`

    Health  HealthStatusDetails `json:"health"`  // Simplified (no Healthy bool)
    Sync    SyncStatusDetails   `json:"sync"`    // Simplified (no State enum)
    Stats   []ResourceCount     `json:"stats,omitempty"`
    Webhook *WebhookStatus      `json:"webhook"`
    Token   TokenStatus         `json:"token,omitempty"`
}
```

**Controller changes**:

```go
// Update all conditions AND legacy fields
func (rc *RepositoryController) updateStatus(ctx context.Context,
    repo *provisioning.Repository, healthStatus HealthStatus,
    syncStatus SyncStatus, fieldErrors []ErrorDetails) error {

    // NEW: Set conditions
    rc.updateReadyCondition(repo, healthStatus, syncStatus, fieldErrors)
    rc.updateHealthCondition(repo, healthStatus)
    rc.updateSyncCondition(repo, syncStatus)
    rc.updateValidatedCondition(repo, fieldErrors)

    // LEGACY: Also update old fields for backward compatibility
    repo.Status.Health = HealthStatus{
        Healthy: healthStatus.Healthy,
        Error:   healthStatus.Error,
        Checked: healthStatus.Checked,
        Message: healthStatus.Message,
    }
    repo.Status.Sync = syncStatus
    repo.Status.FieldErrors = fieldErrors
    repo.Status.ObservedGeneration = repo.Generation

    return rc.statusPatcher.PatchStatus(ctx, repo)
}
```

### Phase 2: Client Migration (v0alpha2)

**Goal**: Update consumers to use Conditions

1. **Update UI/dashboards** to read from Conditions
2. **Update kubectl plugins** to display conditions
3. **Update documentation** to recommend conditions
4. **Add metrics** for condition transitions
5. **Deprecation warnings** when using old fields

**Example kubectl plugin output**:

```bash
$ kubectl get repositories -o wide

NAME           READY   HEALTHY   SYNCED   AGE
my-repo        True    True      True     5d
broken-repo    False   False     False    2d
sync-disabled  True    True      True     1d

$ kubectl describe repository my-repo

Status:
  Conditions:
    Type:                  Ready
    Status:                True
    Reason:                RepositoryReady
    Message:               Repository is healthy and synced
    Last Transition Time:  2024-01-15T10:30:00Z
    Observed Generation:   5

    Type:                  Healthy
    Status:                True
    Reason:                HealthCheckPassed
    Message:               Health check passed successfully
    Last Transition Time:  2024-01-15T10:29:00Z
    Observed Generation:   5

    Type:                  Synced
    Status:                True
    Reason:                SyncSucceeded
    Message:               Last sync completed at 2024-01-15 10:28:30
    Last Transition Time:  2024-01-15T10:28:30Z
    Observed Generation:   5

  Health:
    Checked:  1705318140000
  Sync:
    Job ID:      sync-abc123
    Started:     1705318110000
    Finished:    1705318130000
    Scheduled:   1705318740000
    Last Ref:    main@abc123
  Stats:
    Group:     dashboard
    Resource:  Dashboard
    Count:     42
```

### Phase 3: v1 API (Future)

**Goal**: Remove deprecated fields

1. **Remove** `FieldErrors`, `Health.Healthy`, `Sync.State`, `Connection.State`
2. **Keep** rich detail fields (timestamps, job IDs, stats, etc.)
3. **Conditions become** the single source of truth for status

```go
// v1 status (clean, conditions-first)
type RepositoryStatus struct {
    ObservedGeneration int64              `json:"observedGeneration"`
    Conditions         []metav1.Condition `json:"conditions,omitempty"`

    // Rich details (not status flags)
    Health  HealthStatusDetails `json:"health"`
    Sync    SyncStatusDetails   `json:"sync"`
    Stats   []ResourceCount     `json:"stats,omitempty"`
    Webhook *WebhookStatus      `json:"webhook"`
    Token   TokenStatus         `json:"token,omitempty"`
}

// No Healthy bool, no Error enum
type HealthStatusDetails struct {
    Checked     int64        `json:"checked,omitempty"`
    TestResults []TestResult `json:"testResults,omitempty"`
}

// No State enum
type SyncStatusDetails struct {
    JobID       string `json:"jobID,omitempty"`
    Started     int64  `json:"started,omitempty"`
    Finished    int64  `json:"finished,omitempty"`
    Scheduled   int64  `json:"scheduled,omitempty"`
    LastRef     string `json:"lastRef,omitempty"`
    Incremental bool   `json:"incremental,omitempty"`
}
```

---

## Implementation Examples

### Example 1: Successful Repository Reconciliation

```yaml
apiVersion: provisioning.grafana.app/v0alpha2
kind: Repository
metadata:
  name: my-dashboards
  generation: 5
spec:
  type: github
  sync:
    enabled: true
    intervalSeconds: 300
status:
  observedGeneration: 5
  conditions:
  - type: Ready
    status: "True"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T10:30:00Z"
    reason: RepositoryReady
    message: Repository is healthy and synced
  - type: Healthy
    status: "True"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T10:29:00Z"
    reason: HealthCheckPassed
    message: Health check passed successfully
  - type: Synced
    status: "True"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T10:28:30Z"
    reason: SyncSucceeded
    message: Last sync completed at 2024-01-15 10:28:30
  - type: Validated
    status: "True"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T10:00:00Z"
    reason: ValidationSucceeded
    message: All fields validated successfully
  health:
    checked: 1705318140000
  sync:
    jobID: sync-abc123
    started: 1705318110000
    finished: 1705318130000
    scheduled: 1705318740000
    lastRef: main@abc123
  stats:
  - group: dashboard
    resource: Dashboard
    count: 42
```

### Example 2: Failed Health Check

```yaml
status:
  observedGeneration: 5
  conditions:
  - type: Ready
    status: "False"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T10:30:00Z"
    reason: HealthCheckFailed
    message: "Authentication failed: invalid token"
  - type: Healthy
    status: "False"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T10:30:00Z"
    reason: HealthCheckFailed
    message: "Authentication failed: invalid token"
  - type: Synced
    status: "Unknown"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T10:28:30Z"
    reason: SyncDisabled
    message: Sync disabled due to health check failure
  health:
    checked: 1705318200000
    message:
    - "Authentication failed: invalid token"
```

### Example 3: Sync In Progress

```yaml
status:
  observedGeneration: 5
  conditions:
  - type: Ready
    status: "Unknown"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T10:30:00Z"
    reason: Reconciling
    message: Repository reconciliation in progress
  - type: Healthy
    status: "True"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T10:29:00Z"
    reason: HealthCheckPassed
    message: Health check passed successfully
  - type: Synced
    status: "Unknown"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T10:30:00Z"
    reason: SyncInProgress
    message: Sync job sync-xyz789 is running
  health:
    checked: 1705318140000
  sync:
    jobID: sync-xyz789
    started: 1705318200000
    scheduled: 1705318500000
```

### Example 4: Validation Failure

```yaml
status:
  observedGeneration: 6
  conditions:
  - type: Ready
    status: "False"
    observedGeneration: 6
    lastTransitionTime: "2024-01-15T10:35:00Z"
    reason: ValidationFailed
    message: "2 validation error(s)"
  - type: Validated
    status: "False"
    observedGeneration: 6
    lastTransitionTime: "2024-01-15T10:35:00Z"
    reason: FieldValidationFailed
    message: "Validation failed for fields: spec.connection, spec.github.appID"
  # DEPRECATED: Still populated for backward compatibility
  fieldErrors:
  - type: FieldValueRequired
    field: spec.connection
    detail: "Connection reference is required when using GitHub App authentication"
    origin: spec-validator
  - type: FieldValueInvalid
    field: spec.github.appID
    detail: "AppID must be a valid GitHub App ID"
    badValue: "invalid"
```

### Example 5: Connection Status

```yaml
apiVersion: provisioning.grafana.app/v0alpha2
kind: Connection
metadata:
  name: my-github-app
  generation: 3
status:
  observedGeneration: 3
  conditions:
  - type: Ready
    status: "True"
    observedGeneration: 3
    lastTransitionTime: "2024-01-15T10:30:00Z"
    reason: Connected
    message: Connection test succeeded
  - type: Connected
    status: "True"
    observedGeneration: 3
    lastTransitionTime: "2024-01-15T10:30:00Z"
    reason: TestSucceeded
    message: Successfully authenticated with GitHub
  - type: Validated
    status: "True"
    observedGeneration: 3
    lastTransitionTime: "2024-01-15T10:00:00Z"
    reason: ValidationSucceeded
    message: All fields validated successfully
  health:
    checked: 1705318200000
```

### Example 6: Repository Count Quota Exceeded

```yaml
apiVersion: provisioning.grafana.app/v0alpha2
kind: Repository
metadata:
  name: my-new-repo
  namespace: free-tier-org
  generation: 1
spec:
  type: github
  sync:
    enabled: true
    intervalSeconds: 300
status:
  observedGeneration: 1
  conditions:
  - type: Ready
    status: "False"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T11:00:00Z"
    reason: QuotaExceeded
    message: "Repository count (6) exceeds the limit (5) for free tier. Upgrade to increase limit."
  - type: QuotaCompliant
    status: "False"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T11:00:00Z"
    reason: RepositoryCountExceeded
    message: "Repository count (6) exceeds the limit (5) for free tier. Upgrade to increase limit."
  - type: Validated
    status: "True"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T11:00:00Z"
    reason: ValidationSucceeded
    message: All fields validated successfully
  # Health and Sync conditions are not set - early exit due to quota
  health:
    checked: 0  # Never checked due to quota exceeded
  sync:
    # No sync has run
```

**User Experience**: The UI can detect `QuotaCompliant=False` with `RepositoryCountExceeded` reason and display a prominent upgrade banner with a call-to-action button.

### Example 7: Resource Quota Exceeded per Repository

```yaml
apiVersion: provisioning.grafana.app/v0alpha2
kind: Repository
metadata:
  name: large-dashboard-repo
  namespace: free-tier-org
  generation: 5
spec:
  type: github
  sync:
    enabled: true
    intervalSeconds: 300
status:
  observedGeneration: 5
  conditions:
  - type: Ready
    status: "False"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T12:00:00Z"
    reason: QuotaExceeded
    message: "Repository manages 150 resources, exceeding the limit (100) for free tier. Reduce resources or upgrade to continue syncing."
  - type: Healthy
    status: "True"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T11:59:00Z"
    reason: HealthCheckPassed
    message: Health check passed successfully
  - type: Synced
    status: "False"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T12:00:00Z"
    reason: QuotaExceeded
    message: "Repository manages 150 resources, exceeding the limit (100) for free tier. Reduce resources or upgrade to continue syncing."
  - type: QuotaCompliant
    status: "False"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T12:00:00Z"
    reason: ResourceQuotaExceeded
    message: "Repository manages 150 resources, exceeding the limit (100) for free tier. Reduce resources or upgrade to continue syncing."
  - type: Validated
    status: "True"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T10:00:00Z"
    reason: ValidationSucceeded
    message: All fields validated successfully
  health:
    checked: 1705321140000
  sync:
    jobID: sync-xyz789
    started: 1705321100000
    finished: 1705321200000  # Last sync completed
    lastRef: main@def456
  stats:
  - group: dashboard
    resource: Dashboard
    count: 120
  - group: datasource
    resource: DataSource
    count: 30
  # Total: 150 resources
```

**User Experience**:
- The last sync succeeded and imported 150 resources
- The controller detected quota violation after sync completion
- Future syncs are blocked (`Synced=False` with `QuotaExceeded`)
- The UI shows both the current resource count and the upgrade option
- Users can either delete some resources to get back under quota, or upgrade their tier

### Example 8: Secrets and Webhook Setup in Progress

```yaml
apiVersion: provisioning.grafana.app/v0alpha2
kind: Repository
metadata:
  name: github-repo-with-webhook
  generation: 1
spec:
  type: github
  connection:
    name: my-github-app
  workflows:
  - branch  # Requires webhook for PR workflow
  sync:
    enabled: true
    intervalSeconds: 300
status:
  observedGeneration: 1
  conditions:
  - type: Ready
    status: "False"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T13:00:00Z"
    reason: SecretsNotConfigured
    message: Waiting for token from connection
  - type: Validated
    status: "True"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T13:00:00Z"
    reason: ValidationSucceeded
    message: All fields validated successfully
  - type: SecretsConfigured
    status: "False"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T13:00:00Z"
    reason: TokenPending
    message: Waiting for token from connection
  - type: WebhookConfigured
    status: "False"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T13:00:00Z"
    reason: SecretNotReady
    message: Waiting for webhook secret to be configured
  # Health and Sync not yet attempted - waiting for setup
  health:
    checked: 0
```

**After Secrets Are Configured**:

```yaml
status:
  observedGeneration: 1
  conditions:
  - type: Ready
    status: "True"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T13:00:30Z"
    reason: RepositoryReady
    message: Repository is healthy and synced
  - type: Validated
    status: "True"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T13:00:00Z"
    reason: ValidationSucceeded
    message: All fields validated successfully
  - type: SecretsConfigured
    status: "True"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T13:00:15Z"  # Transitioned after token obtained
    reason: SecretsReady
    message: All required secrets are configured
  - type: WebhookConfigured
    status: "True"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T13:00:20Z"  # Transitioned after webhook created
    reason: WebhookCreated
    message: "Webhook registered with ID 123456"
  - type: Healthy
    status: "True"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T13:00:22Z"
    reason: HealthCheckPassed
    message: Health check passed successfully
  - type: Synced
    status: "True"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T13:00:30Z"
    reason: SyncSucceeded
    message: Last sync completed at 2024-01-15 13:00:30
  health:
    checked: 1705323622000
  sync:
    jobID: sync-initial
    started: 1705323625000
    finished: 1705323630000
    lastRef: main@ghi789
  webhook:
    id: 123456
    url: https://grafana.example.com/webhooks/provisioning/repository/github-repo-with-webhook
    subscribedEvents:
    - pull_request
    - push
```

**User Experience**: The UI can show a progress indicator while `SecretsConfigured=False`, then automatically update when setup completes and the repository becomes ready.

### Example 9: Connection with Token Setup

```yaml
apiVersion: provisioning.grafana.app/v0alpha2
kind: Connection
metadata:
  name: my-github-app
  generation: 2
spec:
  type: github
  github:
    appID: "12345"
    installationID: "67890"
status:
  observedGeneration: 2
  conditions:
  - type: Ready
    status: "True"
    observedGeneration: 2
    lastTransitionTime: "2024-01-15T13:00:10Z"
    reason: Connected
    message: Connection test succeeded
  - type: Validated
    status: "True"
    observedGeneration: 2
    lastTransitionTime: "2024-01-15T13:00:00Z"
    reason: ValidationSucceeded
    message: All fields validated successfully
  - type: SecretsConfigured
    status: "True"
    observedGeneration: 2
    lastTransitionTime: "2024-01-15T13:00:05Z"
    reason: SecretsReady
    message: Token is configured
  - type: Connected
    status: "True"
    observedGeneration: 2
    lastTransitionTime: "2024-01-15T13:00:10Z"
    reason: TestSucceeded
    message: Successfully authenticated with GitHub
  health:
    checked: 1705323610000
```

**User Experience**: Once the connection's `SecretsConfigured=True` and `Connected=True`, repositories referencing this connection can obtain tokens and become ready.

### Example 10: Installation Disabled

```yaml
apiVersion: provisioning.grafana.app/v0alpha2
kind: Connection
metadata:
  name: suspended-github-app
  generation: 3
spec:
  type: github
  github:
    appID: "12345"
    installationID: "67890"
status:
  observedGeneration: 3
  conditions:
  - type: Ready
    status: "False"
    observedGeneration: 3
    lastTransitionTime: "2024-01-15T14:00:00Z"
    reason: InstallationDisabled
    message: "GitHub App installation is suspended: installation was suspended by the organization administrator"
  - type: Validated
    status: "True"
    observedGeneration: 3
    lastTransitionTime: "2024-01-15T13:00:00Z"
    reason: ValidationSucceeded
    message: All fields validated successfully
  - type: SecretsConfigured
    status: "False"
    observedGeneration: 3
    lastTransitionTime: "2024-01-15T14:00:00Z"
    reason: InstallationDisabled
    message: "GitHub App installation is suspended: installation was suspended by the organization administrator"
  - type: Connected
    status: "False"
    observedGeneration: 3
    lastTransitionTime: "2024-01-15T14:00:00Z"
    reason: AuthenticationFailed
    message: Cannot test connection without valid token
  health:
    checked: 1705327200000
```

**User Experience**: Clear message indicating the GitHub App installation was disabled. User needs to re-enable the installation in GitHub settings.

### Example 11: Repository Not Found

```yaml
apiVersion: provisioning.grafana.app/v0alpha2
kind: Repository
metadata:
  name: deleted-repo
  generation: 2
spec:
  type: github
  connection:
    name: my-github-app
  github:
    owner: myorg
    repo: deleted-repo  # This repo was deleted from GitHub
  sync:
    enabled: true
status:
  observedGeneration: 2
  conditions:
  - type: Ready
    status: "False"
    observedGeneration: 2
    lastTransitionTime: "2024-01-15T14:05:00Z"
    reason: HealthCheckFailed
    message: "Repository not found: myorg/deleted-repo"
  - type: Validated
    status: "True"
    observedGeneration: 2
    lastTransitionTime: "2024-01-15T14:00:00Z"
    reason: ValidationSucceeded
    message: All fields validated successfully
  - type: SecretsConfigured
    status: "True"
    observedGeneration: 2
    lastTransitionTime: "2024-01-15T14:02:00Z"
    reason: SecretsReady
    message: All required secrets are configured
  - type: Healthy
    status: "False"
    observedGeneration: 2
    lastTransitionTime: "2024-01-15T14:05:00Z"
    reason: RepositoryNotFound
    message: "Repository not found: myorg/deleted-repo does not exist or token does not have access"
  - type: Synced
    status: "Unknown"
    observedGeneration: 2
    lastTransitionTime: "2024-01-15T14:05:00Z"
    reason: HealthCheckFailed
    message: Cannot sync unhealthy repository
  health:
    checked: 1705327500000
    message:
    - "Repository not found: myorg/deleted-repo does not exist or token does not have access"
```

**User Experience**: Clear indication that the repository doesn't exist. User needs to either fix the repo name or restore the deleted repository.

### Example 12: Branch Not Found

```yaml
apiVersion: provisioning.grafana.app/v0alpha2
kind: Repository
metadata:
  name: wrong-branch
  generation: 3
spec:
  type: github
  connection:
    name: my-github-app
  github:
    owner: myorg
    repo: my-dashboards
    branch: nonexistent-branch  # This branch doesn't exist
  sync:
    enabled: true
status:
  observedGeneration: 3
  conditions:
  - type: Ready
    status: "False"
    observedGeneration: 3
    lastTransitionTime: "2024-01-15T14:10:00Z"
    reason: HealthCheckFailed
    message: "Branch not found: nonexistent-branch"
  - type: Validated
    status: "True"
    observedGeneration: 3
    lastTransitionTime: "2024-01-15T14:00:00Z"
    reason: ValidationSucceeded
    message: All fields validated successfully
  - type: SecretsConfigured
    status: "True"
    observedGeneration: 3
    lastTransitionTime: "2024-01-15T14:02:00Z"
    reason: SecretsReady
    message: All required secrets are configured
  - type: Healthy
    status: "False"
    observedGeneration: 3
    lastTransitionTime: "2024-01-15T14:10:00Z"
    reason: BranchNotFound
    message: "Branch not found: 'nonexistent-branch' does not exist in repository myorg/my-dashboards"
  - type: Synced
    status: "Unknown"
    observedGeneration: 3
    lastTransitionTime: "2024-01-15T14:10:00Z"
    reason: HealthCheckFailed
    message: Cannot sync unhealthy repository
  health:
    checked: 1705327800000
    message:
    - "Branch not found: 'nonexistent-branch' does not exist in repository myorg/my-dashboards"
```

**User Experience**: Helpful error message showing which branch is missing. User can update spec to use correct branch name.

### Example 13: Connection Not Ready (Repository Blocked)

```yaml
apiVersion: provisioning.grafana.app/v0alpha2
kind: Repository
metadata:
  name: blocked-by-connection
  generation: 1
spec:
  type: github
  connection:
    name: suspended-github-app  # References the suspended connection from Example 10
  sync:
    enabled: true
status:
  observedGeneration: 1
  conditions:
  - type: Ready
    status: "False"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T14:15:00Z"
    reason: SecretsNotConfigured
    message: "Connection suspended-github-app is not ready"
  - type: Validated
    status: "True"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T14:15:00Z"
    reason: ValidationSucceeded
    message: All fields validated successfully
  - type: SecretsConfigured
    status: "False"
    observedGeneration: 1
    lastTransitionTime: "2024-01-15T14:15:00Z"
    reason: ConnectionNotReady
    message: "Connection suspended-github-app is not ready"
  # Health and Sync not attempted - can't proceed without token
  health:
    checked: 0
```

**User Experience**: Repository clearly shows it's blocked waiting for the connection to become ready. User needs to fix the connection issue first (re-enable GitHub App installation). Once the connection becomes ready, this repository will automatically proceed with token generation and health checks.

### Example 14: Insufficient Permissions

```yaml
apiVersion: provisioning.grafana.app/v0alpha2
kind: Repository
metadata:
  name: readonly-repo
  generation: 2
spec:
  type: github
  connection:
    name: readonly-connection  # Connection has read-only access
  workflows:
  - branch  # Requires write access for PRs
  sync:
    enabled: true
status:
  observedGeneration: 2
  conditions:
  - type: Ready
    status: "False"
    observedGeneration: 2
    lastTransitionTime: "2024-01-15T14:20:00Z"
    reason: HealthCheckFailed
    message: "Insufficient permissions: token does not have write access required for branch workflow"
  - type: Validated
    status: "True"
    observedGeneration: 2
    lastTransitionTime: "2024-01-15T14:00:00Z"
    reason: ValidationSucceeded
    message: All fields validated successfully
  - type: SecretsConfigured
    status: "True"
    observedGeneration: 2
    lastTransitionTime: "2024-01-15T14:02:00Z"
    reason: SecretsReady
    message: All required secrets are configured
  - type: Healthy
    status: "False"
    observedGeneration: 2
    lastTransitionTime: "2024-01-15T14:20:00Z"
    reason: InsufficientPermissions
    message: "Insufficient permissions: token does not have write access required for branch workflow. Grant 'contents: write' and 'pull_requests: write' permissions."
  - type: WebhookConfigured
    status: "False"
    observedGeneration: 2
    lastTransitionTime: "2024-01-15T14:20:00Z"
    reason: InsufficientPermissions
    message: "Cannot create webhook: token does not have admin access to repository"
  health:
    checked: 1705328400000
    message:
    - "Insufficient permissions: token does not have write access required for branch workflow"
    - "Grant the following permissions to the GitHub App: contents: write, pull_requests: write, webhooks: write"
```

**User Experience**: Detailed explanation of missing permissions with actionable instructions. User needs to update GitHub App permissions or use a different connection with proper access.

### Example 15: Multiple Failures (Priority-based Ready)

This example demonstrates how the Ready condition handles multiple concurrent failures using priority-based reasoning.

```yaml
apiVersion: provisioning.grafana.app/v0alpha2
kind: Repository
metadata:
  name: problematic-repo
  generation: 5
spec:
  type: github
  connection:
    name: broken-connection
  github:
    owner: myorg
    repo: nonexistent-repo
    branch: wrong-branch
  workflows:
  - branch
  sync:
    enabled: true
    intervalSeconds: 300
status:
  observedGeneration: 5
  conditions:
  # Ready shows the HIGHEST priority issue (Validation) but mentions others
  - type: Ready
    status: "False"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T15:00:00Z"
    reason: ValidationFailed
    message: "1 validation error(s) (also: SecretsConfigured=False, Healthy=False)"

  # Individual conditions show ALL specific issues
  - type: Validated
    status: "False"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T15:00:00Z"
    reason: ConnectionNotFound
    message: "Connection broken-connection does not exist"

  - type: SecretsConfigured
    status: "False"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T15:00:00Z"
    reason: ConnectionNotReady
    message: "Connection broken-connection is not ready"

  - type: Healthy
    status: "False"
    observedGeneration: 5
    lastTransitionTime: "2024-01-15T15:00:00Z"
    reason: RepositoryNotFound
    message: "Repository not found: myorg/nonexistent-repo does not exist or token does not have access"

  # Sync and Webhook not attempted due to earlier failures
  health:
    checked: 0

  # FieldErrors preserved for detailed validation feedback
  fieldErrors:
  - type: FieldValueNotFound
    field: spec.connection
    detail: "Connection 'broken-connection' does not exist"
    origin: connection-validator
```

**User Experience - Progressive Issue Resolution**:

**Step 1**: User sees Ready=False with reason `ValidationFailed` and message mentioning other issues
- **Priority action**: Fix validation errors first
- **User creates the missing connection**: `broken-connection`

**Step 2**: After fixing validation, controller re-reconciles. New status:
```yaml
conditions:
- type: Ready
  status: "False"
  reason: SecretsNotConfigured
  message: "Connection broken-connection is not ready (also: Healthy=False)"
- type: Validated
  status: "True"  # Now fixed!
  reason: ValidationSucceeded
- type: SecretsConfigured
  status: "False"
  reason: InstallationDisabled  # Connection has installation disabled
  message: "GitHub App installation is suspended"
- type: Healthy
  status: "False"
  reason: RepositoryNotFound  # Still an issue but lower priority
```

**Step 3**: User fixes the connection (re-enables GitHub App). New status:
```yaml
conditions:
- type: Ready
  status: "False"
  reason: HealthCheckFailed
  message: "Repository not found: myorg/nonexistent-repo"
- type: Validated
  status: "True"
- type: SecretsConfigured
  status: "True"  # Now fixed!
  reason: SecretsReady
- type: Healthy
  status: "False"
  reason: RepositoryNotFound
  message: "Repository not found: myorg/nonexistent-repo does not exist"
```

**Step 4**: User fixes the repository name in spec. Final status:
```yaml
conditions:
- type: Ready
  status: "True"  # Finally ready!
  reason: RepositoryReady
  message: "Repository is healthy and synced"
- type: Validated
  status: "True"
- type: SecretsConfigured
  status: "True"
- type: Healthy
  status: "True"
  reason: HealthCheckPassed
- type: Synced
  status: "True"
  reason: SyncSucceeded
```

**Why this approach works well**:

1. **Guided resolution**: Users fix issues in logical dependency order
2. **No overwhelming lists**: Only see the current blocking issue prominently
3. **Full visibility**: Individual conditions show all problems
4. **Automatic progression**: Controller surfaces next issue after each fix
5. **Standard pattern**: Matches how Deployment, StatefulSet, etc. work in Kubernetes

**Alternative: If you wanted to show ALL failures in Ready message**:

```yaml
- type: Ready
  status: "False"
  reason: NotReady  # Generic reason
  message: "3 issues preventing readiness: validation failed (Connection not found), secrets not configured (Connection not ready), health check failed (Repository not found)"
```

This is more explicit but:
- Reason is less specific (harder for automation to act on)
- Message becomes very long with many failures
- Doesn't guide users on priority/order

The priority-based approach with "also:" hints provides the best balance.

---

## Benefits and Trade-offs

### Benefits of Adopting Conditions

#### Standardization
✅ **Ecosystem Compatibility**: Works with kubectl, k9s, ArgoCD, Flux, etc.
✅ **Familiar Pattern**: Teams already know how to read conditions
✅ **Consistent UX**: Same status pattern across all k8s resources
✅ **Tool Integration**: Prometheus operators, status aggregators work out of the box

#### Observability
✅ **Transition Tracking**: `LastTransitionTime` shows when state changed
✅ **Historical Context**: Conditions preserve state change history
✅ **Structured Reasons**: CamelCase reasons enable pattern matching
✅ **Query-Friendly**: Easy to find all resources in a specific state

#### Development
✅ **Controller Libraries**: Can use `meta.SetStatusCondition()`, `meta.IsStatusConditionTrue()`
✅ **Best Practices**: Follows Kubernetes API conventions
✅ **Code Reuse**: Share condition management logic across resources
✅ **Testing**: Standard test utilities for conditions exist

#### User Experience
✅ **Clear Status**: Single Ready condition answers "is it working?"
✅ **Detailed Reasons**: Conditions explain WHY resource is in a state
✅ **Actionable Messages**: Users know what to fix
✅ **Progressive Disclosure**: Ready at a glance, details when needed

### Trade-offs and Considerations

#### Migration Complexity
⚠️ **Dual Maintenance**: Phase 1 requires updating both conditions and legacy fields
⚠️ **Client Updates**: All consumers need to migrate to conditions
⚠️ **Testing Burden**: Need to test both old and new status paths
⚠️ **Documentation**: Must document migration path clearly

**Mitigation**: Use feature flags to gate condition adoption, allow gradual rollout

#### Information Loss Concerns
⚠️ **Array Messages**: Current `Health.Message` is array, conditions use single string
⚠️ **Multiple Errors**: FieldErrors can have multiple items, Validated condition has one message
⚠️ **Rich Enums**: HealthFailureType enum becomes string Reason

**Mitigation**: Keep detailed fields (Health.Message array, FieldErrors) in status for rich context

#### API Size
⚠️ **Larger Status**: Adding conditions increases status size
⚠️ **Duplicate Data**: Some info exists in both conditions and detail fields

**Mitigation**: Status size increase is minimal, rich details are opt-in

#### Backward Compatibility
⚠️ **Breaking Changes**: Eventually removing old fields will break old clients
⚠️ **Version Skew**: Mixed versions during rollout

**Mitigation**: Long deprecation period (v0alpha2 → v1), conversion webhooks

### Performance Impact

#### Positive Impacts
✅ **No Controller Changes**: Reconciliation logic unchanged
✅ **Same Patch Strategy**: Still batch operations atomically
✅ **Caching Friendly**: Conditions work well with informer caches

#### Minimal Concerns
⚠️ **Slightly Larger Patches**: More data in status updates
⚠️ **Condition Deduplication**: Need to use `meta.SetStatusCondition()` correctly

**Assessment**: Performance impact is negligible

---

## Recommendations

### Immediate Actions (v0alpha2)

1. **Add Conditions field** to RepositoryStatus and ConnectionStatus
2. **Implement condition setters** in controller reconciliation loop (Ready, Healthy, Synced, Validated, QuotaCompliant, SecretsConfigured, WebhookConfigured)
3. **Implement quota enforcement logic** for repository count and resource quotas
4. **Implement secrets and webhook setup tracking** with proper dependency ordering
5. **Populate both** legacy fields and conditions during transition
6. **Add deprecation notices** to legacy field documentation
7. **Update metrics** to track condition transitions, quota violations, and setup failures

### Short Term (Next Quarter)

8. **Update UI** to display conditions prominently (especially QuotaCompliant with upgrade CTAs, SecretsConfigured for setup progress)
9. **Create kubectl plugin** or enhance existing one to show conditions
10. **Document migration guide** for API consumers
11. **Add integration tests** for condition management, quota scenarios, and setup flows
12. **Implement condition-based alerting** in monitoring

### Long Term (v1 API)

13. **Remove deprecated fields** (FieldErrors, Health.Healthy, Sync.State, etc.)
14. **Graduate API to v1** with conditions as primary status
15. **Publish migration success metrics**
16. **Case studies** on improved observability

### Optional Enhancements

17. **Condition Aggregation**: Add a Status field to Repository for high-level phase (Active, Degraded, Failed)
18. **Detailed Subresources**: Consider CRDs for Sync jobs as separate resources
19. **Webhooks**: Admission webhooks to validate condition transitions
20. **Status Printer Columns**: Add kubectl columns for key conditions

---

## Conclusion

The current Grafana provisioning API has a solid foundation with excellent domain-specific status fields, proper ObservedGeneration tracking, and sophisticated reconciliation logic. However, it diverges from Kubernetes conventions by not using the standard Conditions pattern.

**Adopting a hybrid approach** - adding standard Conditions while preserving rich domain-specific fields - provides the best of both worlds:

- **Standard conditions** make the API instantly familiar and compatible with the k8s ecosystem
- **Rich detail fields** preserve the valuable context and information users need
- **Gradual migration** minimizes disruption and allows thorough testing

This proposal recommends moving forward with Phase 1 (additive changes in v0alpha2) as the first step, which is low-risk and provides immediate benefits without breaking existing consumers.

---

## Appendix: Code Templates

### Condition Helper Functions

```go
package conditions

import (
    "fmt"
    "strings"
    "time"

    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/apimachinery/pkg/api/meta"
)

// Condition types
const (
    TypeReady              = "Ready"
    TypeHealthy            = "Healthy"
    TypeSynced             = "Synced"
    TypeValidated          = "Validated"
    TypeQuotaCompliant     = "QuotaCompliant"
    TypeSecretsConfigured  = "SecretsConfigured"
    TypeWebhookConfigured  = "WebhookConfigured"
    TypeConnected          = "Connected"
)

// Common reasons
const (
    // Ready reasons
    ReasonRepositoryReady     = "RepositoryReady"
    ReasonHealthCheckFailed   = "HealthCheckFailed"
    ReasonSyncFailed          = "SyncFailed"
    ReasonValidationFailed    = "ValidationFailed"
    ReasonQuotaExceeded       = "QuotaExceeded"
    ReasonSecretsNotConfigured = "SecretsNotConfigured"
    ReasonReconciling         = "Reconciling"

    // Healthy reasons
    ReasonHealthCheckPassed   = "HealthCheckPassed"
    ReasonHookFailed          = "HookFailed"
    ReasonConnectionUnhealthy = "ConnectionUnhealthy"
    ReasonRepositoryNotFound  = "RepositoryNotFound"
    ReasonBranchNotFound      = "BranchNotFound"
    ReasonInsufficientPermissions = "InsufficientPermissions"

    // Synced reasons
    ReasonSyncSucceeded       = "SyncSucceeded"
    ReasonSyncInProgress      = "SyncInProgress"
    ReasonSyncPending         = "SyncPending"
    ReasonSyncDisabled        = "SyncDisabled"

    // Validated reasons
    ReasonValidationSucceeded      = "ValidationSucceeded"
    ReasonFieldValidationFailed    = "FieldValidationFailed"
    ReasonConnectionNotFound       = "ConnectionNotFound"
    ReasonInvalidAppID             = "InvalidAppID"
    ReasonInvalidInstallationID    = "InvalidInstallationID"
    ReasonInvalidURL               = "InvalidURL"

    // QuotaCompliant reasons
    ReasonWithinQuota              = "WithinQuota"
    ReasonRepositoryCountExceeded  = "RepositoryCountExceeded"
    ReasonResourceQuotaExceeded    = "ResourceQuotaExceeded"

    // SecretsConfigured reasons
    ReasonSecretsReady             = "SecretsReady"
    ReasonTokenPending             = "TokenPending"
    ReasonTokenFailed              = "TokenFailed"
    ReasonConnectionNotReady       = "ConnectionNotReady"
    ReasonInstallationDisabled     = "InstallationDisabled"
    ReasonWebhookSecretPending     = "WebhookSecretPending"
    ReasonWebhookSecretFailed      = "WebhookSecretFailed"
    ReasonSecretsNotRequired       = "NotRequired"

    // WebhookConfigured reasons
    ReasonWebhookCreated           = "WebhookCreated"
    ReasonWebhookFailed            = "WebhookFailed"
    ReasonWebhookNotRequired       = "WebhookNotRequired"
    ReasonSecretNotReady           = "SecretNotReady"

    // Connected reasons
    ReasonConnected                = "Connected"
    ReasonDisconnected             = "Disconnected"
    ReasonTestSucceeded            = "TestSucceeded"
    ReasonTestFailed               = "TestFailed"
    ReasonAuthenticationFailed     = "AuthenticationFailed"
    ReasonAuthorizationRevoked     = "AuthorizationRevoked"
    ReasonNetworkUnreachable       = "NetworkUnreachable"
    ReasonInvalidCredentials       = "InvalidCredentials"
)

// NewCondition creates a new condition
func NewCondition(condType string, status metav1.ConditionStatus,
    reason, message string, generation int64) metav1.Condition {
    return metav1.Condition{
        Type:               condType,
        Status:             status,
        ObservedGeneration: generation,
        LastTransitionTime: metav1.NewTime(time.Now()),
        Reason:             reason,
        Message:            message,
    }
}

// IsConditionTrue checks if a condition is true
func IsConditionTrue(conditions []metav1.Condition, condType string) bool {
    return meta.IsStatusConditionTrue(conditions, condType)
}

// GetCondition finds a condition by type
func GetCondition(conditions []metav1.Condition, condType string) *metav1.Condition {
    return meta.FindStatusCondition(conditions, condType)
}

// SetCondition sets a condition, preserving LastTransitionTime if unchanged
func SetCondition(conditions *[]metav1.Condition, condition metav1.Condition) {
    meta.SetStatusCondition(conditions, condition)
}

// MarkTrue sets a condition to True
func MarkTrue(conditions *[]metav1.Condition, condType, reason, message string, generation int64) {
    SetCondition(conditions, NewCondition(condType, metav1.ConditionTrue, reason, message, generation))
}

// MarkFalse sets a condition to False
func MarkFalse(conditions *[]metav1.Condition, condType, reason, message string, generation int64) {
    SetCondition(conditions, NewCondition(condType, metav1.ConditionFalse, reason, message, generation))
}

// MarkUnknown sets a condition to Unknown
func MarkUnknown(conditions *[]metav1.Condition, condType, reason, message string, generation int64) {
    SetCondition(conditions, NewCondition(condType, metav1.ConditionUnknown, reason, message, generation))
}
```

### Updated Controller Status Update

```go
package controller

import (
    "context"
    "fmt"
    "strings"

    "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha2"
    "github.com/grafana/grafana/pkg/registry/apis/provisioning/controller/conditions"
)

func (rc *RepositoryController) updateAllConditions(
    repo *v0alpha2.Repository,
    healthStatus HealthStatus,
    syncStatus SyncStatus,
    fieldErrors []ErrorDetails,
    quotaExceeded bool,
    quotaMessage string,
) {
    generation := repo.Generation

    // 1. Update QuotaCompliant condition
    if quotaExceeded {
        conditions.MarkFalse(&repo.Status.Conditions,
            conditions.TypeQuotaCompliant,
            conditions.ReasonQuotaExceeded,  // This will be more specific in actual impl
            quotaMessage,
            generation)
    } else {
        conditions.MarkTrue(&repo.Status.Conditions,
            conditions.TypeQuotaCompliant,
            conditions.ReasonWithinQuota,
            "Repository is within quota limits",
            generation)
    }

    // 2. Update Validated condition
    if len(fieldErrors) == 0 {
        conditions.MarkTrue(&repo.Status.Conditions,
            conditions.TypeValidated,
            conditions.ReasonValidationSucceeded,
            "All fields validated successfully",
            generation)
    } else {
        fields := make([]string, len(fieldErrors))
        for i, err := range fieldErrors {
            fields[i] = err.Field
        }
        conditions.MarkFalse(&repo.Status.Conditions,
            conditions.TypeValidated,
            conditions.ReasonFieldValidationFailed,
            fmt.Sprintf("Validation failed for fields: %s", strings.Join(fields, ", ")),
            generation)
    }

    // 3. Update Healthy condition
    if healthStatus.Healthy {
        conditions.MarkTrue(&repo.Status.Conditions,
            conditions.TypeHealthy,
            conditions.ReasonHealthCheckPassed,
            "Health check passed successfully",
            generation)
    } else {
        reason := conditions.ReasonHealthCheckFailed
        if healthStatus.Error == v0alpha2.HealthFailureHook {
            reason = conditions.ReasonHookFailed
        }
        conditions.MarkFalse(&repo.Status.Conditions,
            conditions.TypeHealthy,
            reason,
            strings.Join(healthStatus.Message, "; "),
            generation)
    }

    // 4. Update Synced condition
    if !repo.Spec.Sync.Enabled {
        conditions.MarkTrue(&repo.Status.Conditions,
            conditions.TypeSynced,
            conditions.ReasonSyncDisabled,
            "Sync is disabled for this repository",
            generation)
    } else {
        switch syncStatus.State {
        case v0alpha2.JobStateSuccess:
            conditions.MarkTrue(&repo.Status.Conditions,
                conditions.TypeSynced,
                conditions.ReasonSyncSucceeded,
                fmt.Sprintf("Last sync completed successfully"),
                generation)
        case v0alpha2.JobStateError:
            conditions.MarkFalse(&repo.Status.Conditions,
                conditions.TypeSynced,
                conditions.ReasonSyncFailed,
                strings.Join(syncStatus.Message, "; "),
                generation)
        case v0alpha2.JobStateWorking:
            conditions.MarkUnknown(&repo.Status.Conditions,
                conditions.TypeSynced,
                conditions.ReasonSyncInProgress,
                fmt.Sprintf("Sync job %s is running", syncStatus.JobID),
                generation)
        case v0alpha2.JobStatePending:
            conditions.MarkUnknown(&repo.Status.Conditions,
                conditions.TypeSynced,
                conditions.ReasonSyncPending,
                "Sync job is queued",
                generation)
        }
    }

    // 5. Update Ready condition (aggregate)
    rc.updateReadyCondition(repo, healthStatus, syncStatus, fieldErrors, quotaExceeded, quotaMessage)

    // 6. Update legacy fields for backward compatibility
    repo.Status.Health = healthStatus
    repo.Status.Sync = syncStatus
    repo.Status.FieldErrors = fieldErrors
    repo.Status.ObservedGeneration = generation
}

func (rc *RepositoryController) updateReadyCondition(
    repo *v0alpha2.Repository,
    healthStatus HealthStatus,
    syncStatus SyncStatus,
    fieldErrors []ErrorDetails,
) {
    generation := repo.Generation

    // Priority order for determining Ready status
    switch {
    case len(fieldErrors) > 0:
        conditions.MarkFalse(&repo.Status.Conditions,
            conditions.TypeReady,
            conditions.ReasonValidationFailed,
            fmt.Sprintf("%d validation error(s)", len(fieldErrors)),
            generation)

    case !healthStatus.Healthy:
        conditions.MarkFalse(&repo.Status.Conditions,
            conditions.TypeReady,
            conditions.ReasonHealthCheckFailed,
            strings.Join(healthStatus.Message, "; "),
            generation)

    case repo.Spec.Sync.Enabled && syncStatus.State == v0alpha2.JobStateError:
        conditions.MarkFalse(&repo.Status.Conditions,
            conditions.TypeReady,
            conditions.ReasonSyncFailed,
            strings.Join(syncStatus.Message, "; "),
            generation)

    case healthStatus.Healthy && (!repo.Spec.Sync.Enabled || syncStatus.State == v0alpha2.JobStateSuccess):
        conditions.MarkTrue(&repo.Status.Conditions,
            conditions.TypeReady,
            conditions.ReasonRepositoryReady,
            "Repository is healthy and synced",
            generation)

    default:
        conditions.MarkUnknown(&repo.Status.Conditions,
            conditions.TypeReady,
            conditions.ReasonReconciling,
            "Repository reconciliation in progress",
            generation)
    }
}
```

---

**End of Proposal**
