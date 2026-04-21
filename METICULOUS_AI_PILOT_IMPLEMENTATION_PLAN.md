# Meticulous AI Pilot - Implementation Plan

## Overview

This document breaks down the Meticulous AI pilot integration into atomic commits. Each step is complete, standalone, and independently verifiable before proceeding to the next.

**Implementation Strategy**: Build from backend foundation → frontend integration → feature lockdown → warnings/UI polish

---

## Step 1: Backend Configuration Foundation

**Objective**: Add configuration structure for Meticulous AI settings

**Files Modified**:

- `pkg/setting/setting.go`
- `conf/defaults.ini`

**Changes**:

1. Add fields to settings struct in `pkg/setting/setting.go`:

```go
DangerousMeticulousAIEnabled      bool
DangerousMeticulousAIProjectToken string
DangerousMeticulousAIScriptURL    string
```

2. Parse analytics section config values from INI file

3. Add configuration block to `conf/defaults.ini`:

```ini
# Meticulous AI session recording (DANGEROUS - captures all data including auth tokens)
# Only enable in isolated development environments with synthetic test data
dangerous_meticulous_ai_enabled = false
dangerous_meticulous_ai_project_token =
dangerous_meticulous_ai_script_url = https://snippet.meticulous.ai/v1/meticulous.js
```

**Verification**:

- Start Grafana: `make run`
- Check config parsing succeeds (no errors in logs)
- Set env var: `GF_ANALYTICS_DANGEROUS_METICULOUS_AI_ENABLED=true make run`
- Confirm no crashes or parse errors

**Tests**: None required (config-only change)

**Commit Message**: `feat: add Meticulous AI configuration settings to backend`

---

## Step 2: Feature Flag Registration

**Objective**: Register feature flag for Meticulous AI recording

**Files Modified**:

- `pkg/services/featuremgmt/registry.go`

**Changes**:

1. Add feature flag definition:

```go
{
    Name:            "dangerousMeticulousAIRecording",
    Description:     "Enable Meticulous AI session recording (DANGEROUS - captures all data)",
    State:           FeatureStateExperimental,
    Owner:           grafanaFrontendPlatformSquad,
    RequiresRestart: false,
    HideFromDocs:    true,
    FrontendOnly:    false,
}
```

2. Run code generation: `make gen-feature-toggles`

**Verification**:

- Run: `make gen-feature-toggles`
- Confirm generated files updated without errors
- Start Grafana: `make run`
- Enable via env: `GF_FEATURE_TOGGLES_ENABLE=dangerousMeticulousAIRecording make run`
- Check logs show feature flag loaded

**Tests**: None required (generated code is tested by build)

**Commit Message**: `feat: add dangerousMeticulousAIRecording feature flag`

---

## Step 3: Backend DTOs and Template Data Structure

**Objective**: Add data transfer objects for passing Meticulous settings to frontend

**Files Modified**:

- `pkg/api/dtos/index.go`
- `pkg/api/dtos/frontend_settings.go`

**Changes**:

1. Add fields to `IndexViewData` struct in `pkg/api/dtos/index.go`:

```go
DangerousMeticulousAIEnabled      bool   `json:"-"`
DangerousMeticulousAIProjectToken string `json:"-"`
DangerousMeticulousAIScriptUrl    string `json:"-"`
```

2. Add fields to `FrontendSettingsDTO` in `pkg/api/dtos/frontend_settings.go`:

```go
DangerousMeticulousAIEnabled   bool   `json:"dangerousMeticulousAIEnabled"`
DangerousMeticulousAIScriptUrl string `json:"dangerousMeticulousAIScriptUrl"`
```

**Verification**:

- Run: `make build-backend`
- Confirm compilation succeeds
- Start Grafana: `make run`
- Verify no crashes (fields are zero-valued but present)

**Tests**: None required (struct-only change)

**Commit Message**: `feat: add Meticulous AI fields to backend DTOs`

---

## Step 4: Populate Template Data with Security Checks

**Objective**: Implement server-side gating logic to populate Meticulous data only when all conditions met

**Files Modified**:

- `pkg/api/index.go`

**Changes**:

1. In `setIndexViewData()` function, add conditional population logic:

```go
userEmail := c.GetEmail()
isGrafanaEmployee := strings.HasSuffix(userEmail, "@grafana.com")
meticulousEnabled := hs.Cfg.DangerousMeticulousAIEnabled &&
                     settings.FeatureToggles["dangerousMeticulousAIRecording"] &&
                     (hs.Cfg.Env == setting.Dev) &&
                     isGrafanaEmployee

data.DangerousMeticulousAIEnabled = meticulousEnabled
if meticulousEnabled {
    data.DangerousMeticulousAIProjectToken = hs.Cfg.DangerousMeticulousAIProjectToken
    data.DangerousMeticulousAIScriptUrl = hs.Cfg.DangerousMeticulousAIScriptURL
}
```

2. Add backend warning log when enabled

**Verification**:

- Test 1: Run with all flags OFF → verify data fields empty
- Test 2: Enable only config → verify still empty (missing flag)
- Test 3: Enable config + flag in production env → verify empty (wrong env)
- Test 4: Enable config + flag + dev env with non-@grafana.com user → verify empty
- Test 5: Enable ALL conditions with @grafana.com user → verify populated

**Tests**: Manual verification via debug logging or API inspection

**Commit Message**: `feat: implement server-side gating for Meticulous AI data population`

---

## Step 5: Populate Frontend Settings DTO

**Objective**: Pass Meticulous settings to frontend via settings API

**Files Modified**:

- `pkg/api/frontendsettings.go`

**Changes**:

1. In `getFrontendSettings()` function, populate DTO fields:

```go
DangerousMeticulousAIEnabled:   indexData.DangerousMeticulousAIEnabled,
DangerousMeticulousAIScriptUrl: indexData.DangerousMeticulousAIScriptUrl,
```

**Verification**:

- Start Grafana: `make run` with all conditions enabled
- Open browser DevTools → Network tab
- Find request to `/api/frontend/settings`
- Verify response JSON contains:
  - `dangerousMeticulousAIEnabled: true`
  - `dangerousMeticulousAIScriptUrl: "https://snippet.meticulous.ai/v1/meticulous.js"`

**Tests**: Manual API inspection

**Commit Message**: `feat: expose Meticulous AI settings to frontend settings API`

---

## Step 6: TypeScript Type Definitions

**Objective**: Add TypeScript types for Meticulous settings in frontend

**Files Modified**:

- `packages/grafana-runtime/src/config.ts`
- `packages/grafana-data/src/types/config.ts`

**Changes**:

1. Add fields to `GrafanaBootConfig` interface:

```typescript
dangerousMeticulousAIEnabled?: boolean;
dangerousMeticulousAIScriptUrl?: string;
```

2. Add to feature toggles type if separate interface exists

**Verification**:

- Run: `yarn typecheck`
- Confirm no TypeScript errors
- Run: `yarn build`
- Verify successful build

**Tests**: TypeScript compilation

**Commit Message**: `feat: add TypeScript types for Meticulous AI settings`

---

## Step 7: HTML Template Script Injection

**Objective**: Conditionally inject Meticulous script tag in HTML template

**Files Modified**:

- `public/views/index.html`

**Changes**:

1. Add script block in `<head>` section BEFORE other scripts:

```html
[[if .DangerousMeticulousAIEnabled]] [[if .DangerousMeticulousAIProjectToken]] [[if .DangerousMeticulousAIScriptUrl]]
<script
  nonce="[[.Nonce]]"
  data-recording-token="[[.DangerousMeticulousAIProjectToken]]"
  data-is-production-environment="false"
  src="[[.DangerousMeticulousAIScriptUrl]]"
></script>
[[end]] [[end]] [[end]]
```

2. Add console warning immediately after script tag (inside same conditional)

**Verification**:

- Test 1: Start with conditions OFF → view-source → verify script tag absent
- Test 2: Enable all conditions → view-source → verify script tag present
- Test 3: Check browser DevTools Network tab → verify meticulous.js loads (or 404 if no token)
- Test 4: Verify script placed BEFORE other scripts in `<head>`
- Test 5: Verify nonce attribute present
- Test 6: Console shows warning when script loads

**Tests**: Manual view-source and DevTools inspection

**Commit Message**: `feat: add conditional Meticulous AI script injection in HTML template`

---

## Step 8: Persistent Warning Banner Component

**Objective**: Create React component to display prominent warning banner when Meticulous active

**Files Modified**:

- `public/app/core/components/MeticulousWarningBanner/MeticulousWarningBanner.tsx` (new)
- `public/app/core/components/AppChrome/AppChrome.tsx` (or equivalent root component)

**Changes**:

1. Create warning banner component:

```tsx
export function MeticulousWarningBanner() {
  const config = useGrafana().config;

  if (!config.dangerousMeticulousAIEnabled || !config.featureToggles.dangerousMeticulousAIRecording) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#ff0000',
        color: '#fff',
        padding: '8px',
        textAlign: 'center',
        fontWeight: 'bold',
      }}
    >
      ⚠️⚠️⚠️ METICULOUS AI RECORDING ACTIVE - ALL ACTIONS CAPTURED ⚠️⚠️⚠️
    </div>
  );
}
```

2. Import and render in app root component

**Verification**:

- Start with Meticulous disabled → verify banner NOT visible
- Enable all conditions → verify red banner appears at top
- Scroll page → verify banner remains fixed at top
- Check z-index is above all other elements

**Tests**:

- Manual visual verification
- Consider adding to Playwright visual regression if time permits

**Commit Message**: `feat: add persistent warning banner for Meticulous AI recording`

---

## Step 9: Backend Helper Function for Lockdown Check

**Objective**: Create reusable helper function to check if Meticulous lockdown active

**Files Modified**:

- `pkg/api/http_server.go`

**Changes**:

1. Add helper method to HTTPServer:

```go
func (hs *HTTPServer) isDangerousMeticulousActive() bool {
    return hs.Cfg.DangerousMeticulousAIEnabled &&
           hs.Features.IsEnabledGlobally("dangerousMeticulousAIRecording") &&
           hs.Cfg.Env == setting.Dev
}
```

**Verification**:

- Run: `make build-backend`
- Verify compilation succeeds
- Function will be tested in subsequent steps when used

**Tests**: None required (helper function, tested via usage)

**Commit Message**: `feat: add helper function for Meticulous AI lockdown check`

---

## Step 10: Block Dashboard Import API

**Objective**: Prevent dashboard import when Meticulous active

**Files Modified**:

- `pkg/api/dashboard.go`

**Changes**:

1. Add check at beginning of `PostDashboard` handler:

```go
if hs.isDangerousMeticulousActive() {
    c.JsonApiErr(http.StatusForbidden, "Feature disabled", nil)
    return
}
```

**Verification**:

- Start Grafana with Meticulous disabled
- Import dashboard via API: `POST /api/dashboards/db` → should succeed
- Enable Meticulous (all conditions)
- Attempt import again → should return 403
- Check response body contains "Feature disabled"

**Tests**: Manual API testing with curl or Postman

**Commit Message**: `feat: block dashboard import API when Meticulous AI active`

---

## Step 11: Block Datasource Create/Update APIs

**Objective**: Prevent datasource creation and modification when Meticulous active

**Files Modified**:

- `pkg/api/datasources.go`

**Changes**:

1. Add check to `AddDataSource` handler:

```go
if hs.isDangerousMeticulousActive() {
    c.JsonApiErr(http.StatusForbidden, "Feature disabled", nil)
    return
}
```

2. Add check to `UpdateDataSource` handler (same code)

**Verification**:

- Test datasource create: `POST /api/datasources`
  - Disabled: succeeds
  - Enabled: returns 403
- Test datasource update: `PUT /api/datasources/:id`
  - Disabled: succeeds
  - Enabled: returns 403

**Tests**: Manual API testing

**Commit Message**: `feat: block datasource create/update APIs when Meticulous AI active`

---

## Step 12: Block Dashboard Snapshot APIs

**Objective**: Prevent snapshot creation when Meticulous active

**Files Modified**:

- `pkg/api/dashboard_snapshot.go`

**Changes**:

1. Add check to snapshot creation handlers (likely `CreateDashboardSnapshot`):

```go
if hs.isDangerousMeticulousActive() {
    c.JsonApiErr(http.StatusForbidden, "Feature disabled", nil)
    return
}
```

2. Place check alongside existing `SnapshotEnabled` check (both must pass)

**Verification**:

- Test snapshot create: `POST /api/snapshots`
  - Disabled: succeeds (if snapshots enabled)
  - Enabled: returns 403

**Tests**: Manual API testing

**Commit Message**: `feat: block dashboard snapshot creation when Meticulous AI active`

---

## Step 13: Research and Block Plugin Installation APIs

**Objective**: Identify and block plugin installation endpoints

**Files Modified**:

- `pkg/api/plugins.go` (or relevant plugin API file)

**Changes**:

1. Research: Find plugin install/upload endpoints in codebase
2. Add lockdown check to identified handlers

**Verification**:

- Identify plugin install endpoint (check Admin → Plugins UI network requests)
- Test with Meticulous disabled → should work
- Test with Meticulous enabled → should return 403

**Tests**: Manual API testing + UI verification

**Commit Message**: `feat: block plugin installation when Meticulous AI active`

---

## Step 14: Research and Block Dashboard Export/Share APIs

**Objective**: Identify and block all dashboard export and sharing endpoints

**Files Modified**:

- Research needed: likely `pkg/api/dashboard.go` or separate share handlers

**Changes**:

1. Research: Find endpoints for:
   - Dashboard JSON export
   - Dashboard sharing/embed generation
   - Public dashboard links
2. Add lockdown check to all identified handlers

**Verification**:

- Test each export/share method via UI
- Verify API returns 403 when Meticulous active
- Test: snapshot, embed, link sharing, JSON export

**Tests**: Manual API testing + UI verification

**Commit Message**: `feat: block dashboard export/share APIs when Meticulous AI active`

---

## Step 15: Block User Invite API

**Objective**: Prevent user invitations when Meticulous active

**Files Modified**:

- `pkg/api/org_invite.go`

**Changes**:

1. Add check to invite handler (likely `AddOrgInvite`):

```go
if hs.isDangerousMeticulousActive() {
    c.JsonApiErr(http.StatusForbidden, "Feature disabled", nil)
    return
}
```

**Verification**:

- Test invite API: `POST /api/org/invites`
  - Disabled: succeeds
  - Enabled: returns 403

**Tests**: Manual API testing

**Commit Message**: `feat: block user invitations when Meticulous AI active`

---

## Step 16: Research and Block API Key Creation

**Objective**: Identify and block API key creation endpoints

**Files Modified**:

- Research needed: likely in `pkg/api/` directory

**Changes**:

1. Research: Find API key creation endpoint (check Settings → API Keys UI)
2. Add lockdown check to handler

**Verification**:

- Navigate to API Keys section in UI
- Attempt to create key with Meticulous disabled → succeeds
- Enable Meticulous → should return 403

**Tests**: Manual API testing + UI verification

**Commit Message**: `feat: block API key creation when Meticulous AI active`

---

## Step 17: Block Runtime Provisioning Updates

**Objective**: Prevent provisioning configuration updates while allowing initial startup provisioning

**Files Modified**:

- Research needed: provisioning service files (likely `pkg/services/provisioning/`)

**Changes**:

1. Research: Identify provisioning update methods
2. Add checks to runtime update paths (not initial load)
3. Allow startup provisioning to proceed (TestData datasource from `devenv/datasources.yaml`)

**Verification**:

- Start Grafana with provisioned TestData datasource → should load
- Attempt runtime provisioning update → should be blocked
- Verify TestData datasource usable for queries

**Tests**: Manual verification with provisioning config

**Commit Message**: `feat: block runtime provisioning updates when Meticulous AI active`

---

## Step 18: Disable Dashboard Import UI

**Objective**: Gray out dashboard import button in UI when Meticulous active

**Files Modified**:

- Research needed: likely in `public/app/features/dashboard/` or `public/app/core/components/`

**Changes**:

1. Research: Find dashboard import button component
2. Add disabled prop based on config check:

```typescript
const config = useGrafana().config;
const isMeticulousActive = config.dangerousMeticulousAIEnabled &&
                           config.featureToggles.dangerousMeticulousAIRecording;

<Button disabled={isMeticulousActive}>Import</Button>
```

**Verification**:

- Navigate to dashboard import UI
- With Meticulous disabled → button clickable
- With Meticulous enabled → button grayed out, not clickable
- No error toast when clicking disabled button

**Tests**: Manual UI verification

**Commit Message**: `feat: disable dashboard import UI when Meticulous AI active`

---

## Step 19: Disable Datasource Creation UI

**Objective**: Gray out "Add datasource" button when Meticulous active

**Files Modified**:

- Research needed: likely in `public/app/features/datasources/`

**Changes**:

1. Research: Find datasource creation button/page
2. Add disabled state based on config check
3. Also disable datasource edit forms

**Verification**:

- Navigate to Datasources page
- With Meticulous disabled → "Add data source" clickable
- With Meticulous enabled → button grayed out
- Existing datasources → edit forms disabled/read-only

**Tests**: Manual UI verification

**Commit Message**: `feat: disable datasource creation UI when Meticulous AI active`

---

## Step 20: Disable Snapshot UI

**Objective**: Gray out snapshot creation controls when Meticulous active

**Files Modified**:

- Research needed: likely in `public/app/features/dashboard/`

**Changes**:

1. Research: Find snapshot creation UI (usually in share menu)
2. Add disabled state to snapshot tab/button

**Verification**:

- Open dashboard share menu
- With Meticulous disabled → snapshot option available
- With Meticulous enabled → snapshot option grayed out

**Tests**: Manual UI verification

**Commit Message**: `feat: disable snapshot UI when Meticulous AI active`

---

## Step 21: Disable Plugin Installation UI

**Objective**: Gray out plugin installation controls when Meticulous active

**Files Modified**:

- Research needed: likely in `public/app/features/plugins/`

**Changes**:

1. Research: Find plugin installation UI (Admin → Plugins)
2. Disable install buttons and plugin upload

**Verification**:

- Navigate to Plugins page
- With Meticulous disabled → install buttons clickable
- With Meticulous enabled → buttons grayed out

**Tests**: Manual UI verification

**Commit Message**: `feat: disable plugin installation UI when Meticulous AI active`

---

## Step 22: Disable Dashboard Share/Export UI

**Objective**: Gray out all dashboard sharing and export options when Meticulous active

**Files Modified**:

- Research needed: likely in `public/app/features/dashboard/components/ShareModal/`

**Changes**:

1. Research: Find share modal and export options
2. Disable: link sharing, embed, export JSON, public dashboard
3. Keep share modal accessible but with disabled controls

**Verification**:

- Open dashboard share dialog
- With Meticulous disabled → all options work
- With Meticulous enabled → all share/export options grayed out

**Tests**: Manual UI verification

**Commit Message**: `feat: disable dashboard share/export UI when Meticulous AI active`

---

## Step 23: Disable User Invite UI

**Objective**: Gray out user invitation controls when Meticulous active

**Files Modified**:

- Research needed: likely in `public/app/features/org/` or `public/app/features/users/`

**Changes**:

1. Research: Find user invite button (Server Admin or Org settings)
2. Add disabled state

**Verification**:

- Navigate to user management page
- With Meticulous disabled → invite button clickable
- With Meticulous enabled → button grayed out

**Tests**: Manual UI verification

**Commit Message**: `feat: disable user invite UI when Meticulous AI active`

---

## Step 24: Disable API Key Creation UI

**Objective**: Gray out API key creation controls when Meticulous active

**Files Modified**:

- Research needed: likely in `public/app/features/api-keys/`

**Changes**:

1. Research: Find API key creation UI (Settings → API Keys)
2. Disable "New API Key" button

**Verification**:

- Navigate to API Keys page
- With Meticulous disabled → "New API key" button clickable
- With Meticulous enabled → button grayed out

**Tests**: Manual UI verification

**Commit Message**: `feat: disable API key creation UI when Meticulous AI active`

---

## Step 25: Final Integration Testing and Documentation

**Objective**: Comprehensive end-to-end verification of all features

**Files Modified**: None (testing only)

**Verification Checklist**:

### Security Gating

- [ ] Script does NOT load when feature flag OFF
- [ ] Script does NOT load when config disabled
- [ ] Script does NOT load in non-dev environment
- [ ] Script does NOT load for non-@grafana.com users
- [ ] Script DOES load when ALL conditions met
- [ ] View-source confirms script tag absent when disabled
- [ ] Network tab shows no meticulous.ai requests when disabled

### Feature Lockdown - API

- [ ] Dashboard import blocked (403)
- [ ] Datasource create blocked (403)
- [ ] Datasource update blocked (403)
- [ ] Snapshot create blocked (403)
- [ ] Plugin install blocked (403)
- [ ] Dashboard export blocked (403)
- [ ] User invite blocked (403)
- [ ] API key create blocked (403)
- [ ] Provisioning runtime updates blocked
- [ ] Initial provisioning (TestData) works

### Feature Lockdown - UI

- [ ] Dashboard import button disabled
- [ ] Datasource buttons disabled
- [ ] Snapshot controls disabled
- [ ] Plugin install disabled
- [ ] Dashboard share/export disabled
- [ ] User invite button disabled
- [ ] API key button disabled
- [ ] No error toasts on disabled button clicks
- [ ] All controls visible but grayed out

### Warnings

- [ ] Backend logs warning to stdout when Meticulous initializes
- [ ] Frontend console.error() warning displayed
- [ ] Red banner appears at top of page
- [ ] Banner stays fixed on scroll
- [ ] Banner has z-index above all content

### Revert Test

- [ ] Identify exact commit hash
- [ ] Run: `git revert <commit-hash>`
- [ ] Verify clean revert (no conflicts)
- [ ] Build backend: `make build-backend`
- [ ] Build frontend: `yarn build`
- [ ] Start Grafana: `make run`
- [ ] Confirm Meticulous completely removed

**Tests**: Complete manual test plan execution

**Commit Message**: N/A (testing phase, no code changes)

---

## Post-Implementation

### If Pilot Succeeds

- Keep feature in experimental state
- Document learnings
- Evaluate test quality generated by Meticulous
- Decide on permanent integration or removal

### If Pilot Fails

- Execute single-commit revert
- Document reasons for rejection
- Clean up any config files or environment variables used during trial

---

## Notes

### Atomic Commit Strategy

Each step 1-24 is a single commit that:

- Builds successfully
- Can be verified independently
- Doesn't break existing functionality
- Adds one complete piece of functionality

### Research Tasks

Steps 13, 14, 16, 17 require code investigation. Budget extra time for:

- Grepping codebase for endpoint patterns
- Checking UI network requests
- Reading handler code to understand flow

### Testing Strategy

- Manual testing after each commit
- No automated E2E tests required (per requirements)
- Keep detailed verification notes
- Test both positive (enabled) and negative (disabled) cases

### Rollback Plan

Since implementation is single-commit-per-feature, can rollback partially:

- Full rollback: `git revert <first-commit>^..<last-commit>`
- Partial rollback: Remove specific commits while keeping others

### Time Estimates

- Backend foundation (Steps 1-5): 2-3 hours
- Frontend integration (Steps 6-8): 2 hours
- Backend lockdown (Steps 9-17): 4-6 hours (includes research)
- Frontend lockdown (Steps 18-24): 4-5 hours (includes research)
- Testing (Step 25): 2-3 hours
- **Total: ~15-20 hours**

### Dependencies

- Go 1.25.7
- Node.js v24.x
- Yarn 4.11.0
- GCC (for backend compilation)
- Meticulous AI project token (obtain from Meticulous dashboard)
