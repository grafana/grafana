# Meticulous AI Pilot - Requirements Document

## Overview

This document specifies requirements for integrating Meticulous AI session recording into Grafana for a controlled pilot evaluation. Meticulous AI is a 3rd-party tool that records user sessions including ALL interactions, network requests/responses, and DOM state for automated test generation.

**Security Level: DANGEROUS**

Meticulous captures:

- All user interactions (clicks, typing, scrolling)
- All network requests and responses (including auth tokens)
- LocalStorage, SessionStorage, cookies
- DOM state and visual snapshots
- Only redacts: `type="password"` input fields

Data is sent to external Meticulous cloud infrastructure.

**Naming Convention**: The prefix "dangerous" is used throughout all configuration keys, variable names, and function names to make the security risk explicit and prevent accidental enablement. Every identifier includes "dangerous" or "DANGEROUS" to signal security implications.

## Pilot Goals

1. Enable multiple Grafana engineers to use the application with Meticulous recording active
2. Generate usage data for Meticulous to create automated test suite
3. Evaluate Meticulous effectiveness over 2-3 weeks
4. Maintain zero risk of customer data exposure
5. Enable easy removal via single PR revert if pilot is rejected

## Core Requirements

### R1: Meticulous Script Loading (Server-Side Gated)

**Rationale**: Template-gating provides stronger security than JavaScript-gating because decisions are made server-side before HTML is sent to client, preventing client-side bypass via browser DevTools manipulation. If the conditions are not met, the script tag never appears in the HTML source.

**R1.1**: Meticulous script SHALL only be injected into HTML when ALL conditions are met:

- Feature flag `dangerousMeticulousAIRecording` is enabled
- Config setting `dangerous_meticulous_ai_enabled = true`
- Environment is `setting.Dev` ("development")
- User email ends with `@grafana.com`

**R1.2**: Script injection SHALL occur server-side during HTML template rendering in `public/views/index.html`

**R1.3**: Script tag SHALL use native `<script>` element (not framework components) with attributes:

```html
<script
  nonce="[[.Nonce]]"
  data-recording-token="[[.DangerousMeticulousAIProjectToken]]"
  data-is-production-environment="false"
  src="[[.DangerousMeticulousAIScriptUrl]]"
></script>
```

**R1.3a**: Script tag SHALL be placed in `<head>` section BEFORE all other script tags (Meticulous must load first to capture all network requests)

**R1.3b**: Script tag SHALL NOT have `async` or `defer` attributes (must execute synchronously to guarantee initialization before other scripts)

**R1.4**: Script SHALL auto-initialize (no manual JavaScript `window.meticulous.init()` required) based on `data-*` attributes

**R1.5**: Script URL SHALL be configurable with default: `https://snippet.meticulous.ai/v1/meticulous.js`

### R2: Feature Flag Configuration

**R2.1**: Feature flag SHALL be named `dangerousMeticulousAIRecording`

**R2.2**: Feature flag SHALL:

- Default to `false` (disabled)
- Be stage `FeatureStageExperimental` (or lower if available)
- Be hidden from documentation (`HideFromDocs: true`)
- Not require restart (`RequiresRestart: false`)
- Be frontend-visible (`Generate{LegacyFrontend: true}`)
- Owner: `grafanaFrontendPlatformSquad`

**R2.3**: Feature flag SHALL be defined in `pkg/services/featuremgmt/registry.go`

**R2.4**: After adding feature flag, code generation MUST be run: `make gen-feature-toggles`

### R3: Configuration Settings

**R3.1**: Configuration keys in `conf/defaults.ini` under `[analytics]` section:

```ini
# Meticulous AI session recording (DANGEROUS - captures all data including auth tokens)
# Only enable in isolated development environments with synthetic test data
dangerous_meticulous_ai_enabled = false
dangerous_meticulous_ai_project_token =
dangerous_meticulous_ai_script_url = https://snippet.meticulous.ai/v1/meticulous.js
```

**R3.2**: Environment variable names:

- `GF_ANALYTICS_DANGEROUS_METICULOUS_AI_ENABLED`
- `GF_ANALYTICS_DANGEROUS_METICULOUS_AI_PROJECT_TOKEN`
- `GF_ANALYTICS_DANGEROUS_METICULOUS_AI_SCRIPT_URL`

**R3.3**: Go configuration struct fields in `pkg/setting/setting.go`:

```go
DangerousMeticulousAIEnabled      bool
DangerousMeticulousAIProjectToken string
DangerousMeticulousAIScriptURL    string
```

**R3.4**: Configuration parsing SHALL be added in `pkg/setting/setting.go` within the analytics section parsing code

### R4: Email Restriction

**R4.1**: User email restriction SHALL be checked in TWO places (defense in depth):

1. **Server-side (primary)**: When populating template data for HTML rendering in `pkg/api/index.go`. If email check fails, do not populate template fields.
2. **Client-side (secondary)**: Additional check in JavaScript immediately after Meticulous script loads to verify email before allowing recording to proceed.

**R4.2**: Email check: `strings.HasSuffix(userEmail, "@grafana.com")`

**R4.3**: Only users with `@grafana.com` email suffix SHALL have Meticulous script loaded

**R4.4**: Client-side check implementation: If script loads despite server-side check failure (edge case), JavaScript should verify email and abort recording if mismatch detected.

### R5: Feature Lockdown (Global)

**Rationale**: Engineers might accidentally import production dashboards, add production datasources, or work with existing customer data in their local environment. Locking down these features forces use of only TestData datasource and prevents accidental exposure of real customer queries, credentials, or data to Meticulous recording infrastructure.

**R5.1**: When Meticulous conditions are met (feature flag + config + environment), the following features SHALL be DISABLED for ALL users (not just @grafana.com):

1. Dashboard import
2. Datasource creation and modification
3. Dashboard snapshots
4. Plugin installation and upload
5. Dashboard export and sharing (all methods: snapshot, embed, link, JSON export)
6. Provisioning updates (runtime updates blocked; initial startup provisioning allowed)
7. User invites
8. API key creation

**R5.2**: Feature lockdown SHALL be GLOBAL - applies to all users when Meticulous is active for any user. This prevents non-@grafana.com users from accidentally introducing sensitive data into the recorded environment.

**R5.3**: Lockdown check function (example):

```go
func (hs *HTTPServer) isDangerousMeticulousActive() bool {
    return hs.Cfg.DangerousMeticulousAIEnabled &&
           hs.Features.IsEnabledGlobally("dangerousMeticulousAIRecording") &&
           hs.Cfg.Env == setting.Dev
    // Note: No email check - this is GLOBAL for all users
}
```

### R6: Backend API Blocking

**R6.1**: Backend API endpoints SHALL return HTTP 403 when feature is locked down

**R6.2**: Error response format (following existing pattern from `pkg/api/dashboard_snapshot.go`):

```go
c.JsonApiErr(http.StatusForbidden, "Feature disabled", nil)
```

**R6.3**: API endpoints to block:

| Feature           | Endpoint Pattern                | Handler Function   | File Location                   |
| ----------------- | ------------------------------- | ------------------ | ------------------------------- |
| Dashboard import  | `POST /api/dashboards/db`       | `PostDashboard`    | `pkg/api/dashboard.go`          |
| Datasource create | `POST /api/datasources`         | `AddDataSource`    | `pkg/api/datasources.go`        |
| Datasource update | `PUT /api/datasources/:id`      | `UpdateDataSource` | `pkg/api/datasources.go`        |
| Snapshot create   | `POST /api/snapshots`           | Snapshot handlers  | `pkg/api/dashboard_snapshot.go` |
| Plugin install    | Plugin install/upload endpoints | Plugin handlers    | `pkg/api/plugins.go`            |
| Dashboard export  | Dashboard export endpoints      | Export handlers    | _Research needed_               |
| User invites      | `POST /api/org/invites`         | Invite handlers    | `pkg/api/org_invite.go`         |
| API keys          | `POST /api/auth/keys`           | API key handlers   | _Research needed_               |

**R6.4**: Check SHALL be added at the beginning of each handler function before processing:

```go
if hs.isDangerousMeticulousActive() {
    c.JsonApiErr(http.StatusForbidden, "Feature disabled", nil)
    return
}
```

**R6.5**: For snapshots: Check SHALL be added IN ADDITION to existing `SnapshotEnabled` config check (both must pass)

**R6.6**: For provisioning: Block runtime provisioning updates via provisioning service. Initial startup provisioning (TestData datasource from `devenv/datasources.yaml`) is allowed. Prevent calls to provisioning service update methods when Meticulous active.

### R7: Frontend UI Changes

**R7.1**: UI elements for locked features SHALL be shown but in disabled/grayed-out state (not hidden entirely)

**R7.2**: UI elements SHALL NOT show error toasts when clicked while disabled (standard disabled button behavior)

**R7.3**: Implementation: Check `config.featureToggles.dangerousMeticulousAIRecording && config.dangerousMeticulousAIEnabled`

**R7.4**: UI components to disable:

- Dashboard import button
- "Add datasource" button
- Snapshot creation controls
- Plugin installation UI
- Dashboard share/export buttons (all sharing methods)
- User invite button
- API key creation button

### R8: Warning Messages

**R8.1**: Backend SHALL log warning to stdout when Meticulous initializes (when populating template data):

```
⚠️⚠️⚠️ METICULOUS AI RECORDING ACTIVE ⚠️⚠️⚠️
Environment: development
User: user@grafana.com
ALL SESSION DATA SENT TO METICULOUS.AI
Do NOT use real credentials or customer data
```

**R8.2**: Frontend SHALL display console.error() warning when Meticulous loads:

```javascript
console.error(
  '⚠️⚠️⚠️ METICULOUS AI RECORDING ACTIVE ⚠️⚠️⚠️\n' +
    'ALL actions are being recorded\n' +
    'Data sent to external Meticulous servers\n' +
    'NEVER enter real credentials or sensitive data'
);
```

**R8.2a**: Console warning SHALL be displayed in template script block immediately AFTER Meticulous script tag (so warning appears in console before recording starts)

**R8.3**: Frontend SHALL display persistent banner at top of page when Meticulous active:

```html
<div
  style="position: fixed; top: 0; left: 0; right: 0; z-index: 9999; 
            background: #ff0000; color: #fff; padding: 8px; 
            text-align: center; font-weight: bold;"
>
  ⚠️⚠️⚠️ METICULOUS AI RECORDING ACTIVE - ALL ACTIONS CAPTURED ⚠️⚠️⚠️
</div>
```

**R8.3a**: Banner SHALL be implemented as:

- React component in app root
- Conditional render based on `config.dangerousMeticulousAIEnabled && config.featureToggles.dangerousMeticulousAIRecording`
- Positioned above all other UI elements (z-index: 9999)
- Red background (#ff0000) with white text for maximum visibility

### R9: Template Data Structure

**R9.1**: Add fields to `pkg/api/dtos/index.go`:

```go
type IndexViewData struct {
    // ... existing fields
    DangerousMeticulousAIEnabled      bool   `json:"-"`
    DangerousMeticulousAIProjectToken string `json:"-"`
    DangerousMeticulousAIScriptUrl    string `json:"-"`
}
```

**R9.2**: Populate fields in `pkg/api/index.go` `setIndexViewData()` function with ALL conditions checked:

```go
userEmail := c.GetEmail()
isGrafanaEmployee := strings.HasSuffix(userEmail, "@grafana.com")

data := dtos.IndexViewData{
    // ... existing fields
    DangerousMeticulousAIEnabled: hs.Cfg.DangerousMeticulousAIEnabled &&
                                  settings.FeatureToggles["dangerousMeticulousAIRecording"] &&
                                  (hs.Cfg.Env == setting.Dev) &&
                                  isGrafanaEmployee,
    DangerousMeticulousAIProjectToken: hs.Cfg.DangerousMeticulousAIProjectToken,
    DangerousMeticulousAIScriptUrl:    hs.Cfg.DangerousMeticulousAIScriptURL,
}
```

**R9.3**: Frontend settings DTO (`pkg/api/dtos/frontend_settings.go`):

```go
DangerousMeticulousAIEnabled bool   `json:"dangerousMeticulousAIEnabled"`
DangerousMeticulousAIScriptUrl string `json:"dangerousMeticulousAIScriptUrl"`
```

**R9.3a**: Populate in `pkg/api/frontendsettings.go` in the `getFrontendSettings()` function within the FrontendSettingsDTO struct initialization

### R10: Code Organization

**R10.1**: All changes SHALL be atomic - single commit for easy revert

**R10.2**: Inline comments SHALL be lean and focus on "why" not "what"

**R10.3**: No separate documentation files SHALL be created (requirements doc is exception)

**R10.4**: Comment format for dangerous features:

```go
// DANGEROUS: Meticulous AI - [brief explanation]
```

## Implementation Checklist

### Backend Changes

- [ ] Add feature flag to `pkg/services/featuremgmt/registry.go`
- [ ] Run `make gen-feature-toggles` after adding flag
- [ ] Add config fields to `pkg/setting/setting.go` (struct definition)
- [ ] Parse config from INI in `pkg/setting/setting.go` (analytics section)
- [ ] Add fields to `pkg/api/dtos/index.go` IndexViewData
- [ ] Add fields to `pkg/api/dtos/frontend_settings.go`
- [ ] Populate template data in `pkg/api/index.go` with all conditions
- [ ] Populate frontend settings in `pkg/api/frontendsettings.go`
- [ ] Add `isDangerousMeticulousActive()` helper function to `pkg/api/http_server.go`
- [ ] Block dashboard import in `pkg/api/dashboard.go` PostDashboard
- [ ] Block datasource create in `pkg/api/datasources.go` AddDataSource
- [ ] Block datasource update in `pkg/api/datasources.go` UpdateDataSource
- [ ] Block snapshot creation in `pkg/api/dashboard_snapshot.go` (all snapshot handlers)
- [ ] Block plugin install in `pkg/api/plugins.go`
- [ ] Research and block dashboard export/share endpoints
- [ ] Block user invites in `pkg/api/org_invite.go`
- [ ] Research and block API key creation endpoints
- [ ] Block provisioning updates (determine approach)
- [ ] Add stdout warning logs in `pkg/api/index.go`
- [ ] Update `conf/defaults.ini` with new config keys and comments

### Frontend Changes

- [ ] Add template conditional in `public/views/index.html` (triple-nested if statements)
- [ ] Add Meticulous script tag in `<head>` BEFORE other scripts
- [ ] Add console warning in script block immediately after Meticulous script
- [ ] Create persistent warning banner React component
- [ ] Add banner to app root with conditional rendering
- [ ] Disable dashboard import UI
- [ ] Disable datasource creation UI
- [ ] Disable snapshot UI
- [ ] Disable plugin installation UI
- [ ] Disable dashboard share/export UI (all sharing methods)
- [ ] Disable user invite UI
- [ ] Disable API key creation UI
- [ ] Update TypeScript types in `packages/grafana-runtime/src/config.ts`
- [ ] Update TypeScript types in `packages/grafana-data/src/types/config.ts`

### Research Tasks

- [ ] Locate dashboard export API endpoints (specific handlers and files)
- [ ] Locate API key creation endpoint files in `pkg/api/`
- [ ] Determine provisioning service blocking approach (which methods to intercept)

### Testing

- [ ] Verify script DOES NOT load when flag OFF (view-source check)
- [ ] Verify script DOES NOT load when user email != @grafana.com
- [ ] Verify script DOES load when all conditions met
- [ ] Verify features locked for all users when active (test with non-@grafana.com account)
- [ ] Verify 403 errors returned for blocked endpoints (test all 8 features)
- [ ] Verify UI elements disabled but visible (grayed out)
- [ ] Verify warnings displayed (backend logs + frontend console + banner)
- [ ] Verify via view-source: script tag NOT present in HTML when disabled
- [ ] Verify via DevTools Network tab: no request to meticulous.ai when disabled
- [ ] Verify easy single-commit revert (git revert should cleanly remove all changes)

## Security Considerations

**S1**: This feature is DANGEROUS and captures all user data including:

- Network requests and responses (auth tokens, API keys)
- User input (except password fields)
- Dashboard queries and data
- Datasource credentials visible in UI
- LocalStorage and SessionStorage contents
- All cookies accessible to JavaScript

**S2**: Feature lockdown prevents accidental exposure of:

- Customer dashboards via import
- Production datasource credentials
- Real data via queries
- Sensitive configuration
- External user access (via invites)
- API keys created during pilot

**S3**: Only synthetic test data (TestData datasource) should be used during pilot

**S4**: Feature SHALL be disabled by default and require explicit configuration in three places (flag + config + environment)

**S5**: Feature SHALL only work in development environment (`setting.Dev`) - additional server-side check prevents use in staging or production

## Success Criteria

1. Meticulous script loads only for @grafana.com users in development
2. All 8 features successfully locked down when active
3. No accidental data exposure possible (verified through testing)
4. Clean single-commit revert if pilot fails
5. Multiple engineers can use Grafana to generate session recordings
6. Zero production/customer data risk

## Constraints

- Must run locally via `make run` (no Docker Compose required)
- Must work with existing Grafana build/test processes
- Must not break existing functionality when disabled
- Must be removable in single PR revert
- Must follow existing Grafana patterns (feature flags, config, error responses)

## Non-Requirements

- Docker Compose trial environment (user will handle deployment)
- Automated E2E tests (manual verification acceptable)
- Separate documentation beyond this requirements file
- Configuration UI for enabling/disabling
- Runtime toggle (must restart server after config change)

## References

- Meticulous AI Docs: https://app.meticulous.ai/docs
- Meticulous Recorder Installation: https://app.meticulous.ai/docs/recorder-installation
- Meticulous Security Warning: Captures auth tokens and headers
- Grafana Feature Toggle System: `pkg/services/featuremgmt/`
- Existing Disable Pattern: `SnapshotEnabled` in `pkg/api/dashboard_snapshot.go`
- Go Template Syntax: `public/views/index.html`
