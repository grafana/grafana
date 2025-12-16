# POC: Integration Versioning for Single Alert Manager

> **Documentation for the frontend implementation of integration versioning**  
> Part of: [Single Alertmanager Project](https://github.com/grafana/alerting-squad/issues/1113)  
> GitHub Issue: [Stage 2 - Show Mimir Config in UI](https://github.com/grafana/alerting-squad/issues/1153)  
> Design Doc: [Migration of Mimir integrations to Grafana](https://docs.google.com/document/d/1kZ5uiNm0lqEPFUmG0ojlkbx7dYnGT2afcyucRdtLVOY/edit)

---

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Architecture](#architecture)
- [Implementation](#implementation)
- [Testing Guide](#testing-guide)
- [Demo Setup](#demo-setup)
- [Troubleshooting](#troubleshooting)
- [Backend Integration](#backend-integration)
- [Migration to Production](#migration-to-production)
- [Next Steps](#next-steps)

---

## Overview

This POC demonstrates the frontend implementation of integration versioning to support the migration from Mimir Alert Manager to a unified **Grafana Alert Manager**.

⚠️ **IMPORTANT:** This is ONLY for **Grafana Alert Manager** receivers, NOT for Cloud/External Alert Managers.

### What's Been Implemented

✅ **Integration Versioning (Stage 2)**

- Visual badges for legacy (Mimir) integrations
- Read-only state for imported integrations
- Dropdown filtering (create vs edit mode)
- Version detection and display
- Mock data for testing without backend

⏳ **Templates Versioning (Future)**

- Filter templates by integration version
- Visual indicators for template versions

---

## Problem Statement

When migrating from Mimir to Grafana Alert Manager, we need to support:

1. **Multiple versions** of the same integration (e.g., Slack v0mimir1 from Mimir, Slack v1 from Grafana)
2. **Legacy integrations** that should be maintained but not created
3. **Seamless user experience** where version complexity is minimized
4. **No breaking changes** during migration

### Design Decision

**Proposal 2: Versioned Integrations** (from design doc)

- Mimir integrations = **v0mimir1** (legacy, read-only)
- Grafana integrations = **v1** (current, editable)
- Users can only create **v1**, but can view/use **v0mimir1**
- Templates are also versioned and must match integration version

---

## Architecture

### Version Naming Scheme

| Version    | Description                    | Can Create? | Use Case                  |
| ---------- | ------------------------------ | ----------- | ------------------------- |
| `v1`       | Grafana integrations (current) | ✅ Yes      | All new contact points    |
| `v0mimir1` | Mimir integrations (base)      | ❌ No       | Imported from Mimir       |
| `v0mimir2` | Mimir MSTeams v2               | ❌ No       | Special Mimir integration |

### Type Differentiation

```typescript
// Grafana v1
type: 'slack'         version: 'v1'

// Mimir v0
type: 'slack_v0mimir1'  version: 'v0mimir1'
```

Using different `type` values ensures the system can distinguish versions without conflicts.

### Data Flow

```
Backend API → enrichNotifiersWithVersionsPOC() → Notifiers with versions
                                                       ↓
                                      GrafanaReceiverForm
                                                       ↓
                                      ChannelSubForm
                                                       ↓
                              [Create Mode] → Filter to v1 only
                              [Edit Mode]   → Show current + v1 options
                                                       ↓
                                      Visual Badges + Read-Only State
```

---

## Implementation

### 1. Type Extensions

**File:** `types/alerting.ts`

Simplified to use only `version` field (metadata derived from helpers):

```typescript
export interface NotifierDTO {
  // ... existing fields

  // Integration versioning support
  version?: string; // "v0mimir1", "v1"
}
```

### 2. Version Helpers

**File:** `utils/integration-versions.ts` ⭐ NEW

Centralized version metadata and logic:

```typescript
export const VERSION_INFO = {
  v0mimir1: {
    deprecated: true,
    canCreate: false,
    label: 'Mimir (Legacy)',
  },
  v1: {
    deprecated: false,
    canCreate: true,
    label: 'Grafana',
  },
} as const;

// Helper functions
export function isDeprecatedVersion(version?: string): boolean;
export function canCreateVersion(version?: string): boolean;
export function isMimirVersion(version?: string): boolean;
export function getLatestVersion(): IntegrationVersion;
```

**Benefits:**

- ✅ Single source of truth for version semantics
- ✅ Easy to add new versions (just update VERSION_INFO)
- ✅ Type-safe with TypeScript
- ✅ Centralized logic, used everywhere

### 3. POC Utilities

**File:** `utils/notifier-versions-poc.ts`

Simulates backend support by enriching notifiers:

```typescript
// Takes notifiers from backend (without versions)
// Returns notifiers with v1 + v0mimir1 versions for selected integrations

export function enrichNotifiersWithVersionsPOC(notifiers: NotifierDTO[]): NotifierDTO[];
export function getLatestVersions(notifiers: NotifierDTO[]): NotifierDTO[];
export function groupNotifiersByName(notifiers: NotifierDTO[]): Record<string, NotifierDTO[]>;
```

**Integrations with legacy versions:**

- `slack`
- `webhook`
- `email`
- `telegram`
- `discord`

**When to remove:** When backend provides `version` field in `/api/alert-notifiers`

### 4. UI Changes

**File:** `components/receivers/form/ChannelSubForm.tsx`

#### Dropdown Filtering

```typescript
const typeOptions = useMemo(() => {
  const latestVersions = getLatestVersions(notifierDTOs);

  // IMPORTANT: Also include currently selected type (for edit mode)
  const notifiersToShow = notifiers.filter(
    (notifier) => latestVersionsMap.has(notifier.dto.type) || notifier.dto.type === selectedType
  );

  // Show version in label if not v1
  return notifiersToShow.map(({ dto: { name, type, version } }) => ({
    label: `${name}${version && version !== 'v1' ? ` (${version})` : ''}`,
    value: type,
  }));
}, [notifiers, selectedType]);
```

**Result:**

- **Create mode**: Only v1 (Slack, Email, Webhook...)
- **Edit mode**: Current version + all v1 (Slack (v0mimir1), Email, Webhook...)

#### Visual Badges

```tsx
{
  isLegacyVersion && integrationVersion && (
    <Stack direction="row" gap={0.5}>
      <Badge
        text="Legacy (Mimir)"
        color="orange"
        icon="exclamation-triangle"
        tooltip="Settings are read-only but you can change to a different integration type"
      />
      <Badge
        text={integrationVersion.toUpperCase()}
        color="orange"
        tooltip={`Integration version: ${integrationVersion}`}
      />
    </Stack>
  );
}
```

#### Read-Only State

```typescript
const isLegacyVersion = isDeprecatedVersion(notifier?.dto.version);
const isLegacyReadOnly = isLegacyVersion && isEditable;

// Applied to all form fields
<ChannelOptions readOnly={!isEditable || isLegacyReadOnly} />
```

#### Informational Alert

```tsx
{
  isLegacyVersion && (
    <Alert title="Legacy Integration - Read Only" severity="info">
      This integration was imported from Mimir and is currently in read-only mode. To edit or update this integration,
      you will need to convert it to the latest version first. This is part of the migration to the unified Grafana
      Alert Manager.
    </Alert>
  );
}
```

### 5. Form Integration

**File:** `components/receivers/form/GrafanaReceiverForm.tsx`

```typescript
// POC: Enrich notifiers with version information
const enrichedNotifiers = enrichNotifiersWithVersionsPOC(grafanaNotifiers);

const notifiers: Notifier[] = enrichedNotifiers.map((n) => {
  // ... map to Notifier format
});
```

**Note:** `CloudReceiverForm.tsx` is **NOT modified** - this is specific to Grafana AM only.

### 6. Mock Data

**File:** `mocks/server/entities/alertmanager-config/grafana-alertmanager-config.ts`

Two legacy contact points for testing:

```javascript
{
  name: 'Legacy Slack from Mimir',
  grafana_managed_receiver_configs: [{
    type: 'slack_v0mimir1',  // ← Legacy type
    settings: { recipient: '#alerts-legacy' },
  }],
},
{
  name: 'Legacy Webhook from Mimir',
  grafana_managed_receiver_configs: [{
    type: 'webhook_v0mimir1',  // ← Legacy type
    settings: { url: 'https://example.com/webhook/mimir-legacy' },
  }],
}
```

---

## Testing Guide

### Test 1: Create New Contact Point (No Badges)

**Steps:**

1. Navigate to: `http://localhost:3000/alerting/notifications`
2. Click **"New contact point"**
3. Open **Integration** dropdown

**Expected:**

- ✅ Only see each integration ONCE (Slack, Email, Webhook...)
- ✅ NO duplicates
- ✅ NO badges
- ✅ NO legacy versions available

**Why:** Users cannot create new legacy integrations, only v1.

### Test 2: Edit Legacy Contact Point (With Badges) ⭐

**Steps:**

1. Navigate to: `http://localhost:3000/alerting/notifications`
2. Find **"Legacy Slack from Mimir"** or **"Legacy Webhook from Mimir"**
3. Click **Edit** (pencil icon)

**Expected:**

```
Integration: [Slack (v0mimir1) ▼]
🟠 Legacy (Mimir) ⚠️   🟠 V0MIMIR1

ℹ️ Legacy Integration - Read Only
This integration was imported from Mimir...

[All form fields DISABLED/grayed out]
```

### Test 3: Dropdown Behavior in Edit Mode

**Steps:**

1. While editing legacy contact point
2. Open **Integration** dropdown

**Expected:**

- ✓ Slack (v0mimir1) ← Currently selected
- Slack ← Can convert to v1
- Email
- Webhook
- ...

**Note:** Selecting "Slack" (v1) acts as manual conversion.

### Test 4: Verify Mocks Loaded

**Via UI:**

- See "Legacy Slack from Mimir" in contact points list

**Via API:**

```bash
curl http://localhost:3000/api/alertmanager/grafana/config/api/v1/alerts \
  | jq '.alertmanager_config.receivers[] | select(.name | contains("Legacy"))'
```

---

## Demo Setup

### Using Included Mocks ⭐ RECOMMENDED

The POC includes 2 legacy contact points in mocks:

1. **"Legacy Slack from Mimir"** (`slack_v0mimir1`)
2. **"Legacy Webhook from Mimir"** (`webhook_v0mimir1`)

**To use:**

```bash
yarn start
# Navigate to Alerting > Contact points
# Edit "Legacy Slack from Mimir" → See badges!
```

### Creating Additional Legacy Contact Points

Edit: `mocks/server/entities/alertmanager-config/grafana-alertmanager-config.ts`

Add to `receivers` array:

```javascript
{
  name: 'My Legacy Email',
  grafana_managed_receiver_configs: [
    {
      uid: 'my-legacy-uid',
      name: 'My Legacy Email',
      type: 'email_v0mimir1',  // ← Must use _v0mimir1 suffix
      settings: {
        addresses: 'test@example.com',
      },
      secureFields: {},
    },
  ],
},
```

**Available legacy types:**

- `slack_v0mimir1`
- `webhook_v0mimir1`
- `email_v0mimir1`
- `telegram_v0mimir1`
- `discord_v0mimir1`

---

## Troubleshooting

### Problem: Don't see legacy contact points in list

**Solution:**

1. Verify mocks are loaded:

   ```bash
   grep -n "Legacy Slack" public/app/features/alerting/unified/mocks/server/entities/alertmanager-config/grafana-alertmanager-config.ts
   ```

2. Check MSW is enabled (dev mode should have it by default)

3. Restart Grafana: `yarn start`

### Problem: Contact points exist but no badges

**Debug Step 1:** Check if notifier is found

Add to `ChannelSubForm.tsx` (line ~204):

```typescript
const notifier = notifiers.find(({ dto: { type } }) => type === selectedType);
console.log('🔍 Looking for type:', selectedType);
console.log('📦 Found notifier:', notifier);
console.log(
  '📋 Available types:',
  notifiers.map((n) => n.dto.type)
);
```

**Debug Step 2:** Check if enrichment is working

Add to `GrafanaReceiverForm.tsx` (line ~141):

```typescript
const enrichedNotifiers = enrichNotifiersWithVersionsPOC(grafanaNotifiers);
console.log('🎨 Original:', grafanaNotifiers.length);
console.log('✨ Enriched:', enrichedNotifiers.length);
console.log(
  '📝 Types:',
  enrichedNotifiers.map((n) => n.type)
);
```

**Expected:** Enriched should have ~2x more notifiers (v1 + v0mimir1 for 5 integrations)

### Problem: Badges don't appear

**Debug:** Check version detection

Add to `ChannelSubForm.tsx` (line ~214):

```typescript
const integrationVersion = notifier?.dto.version;
const isLegacyVersion = isDeprecatedVersion(integrationVersion);
console.log('🔖 Version:', integrationVersion);
console.log('🟠 Is legacy:', isLegacyVersion);
```

**Expected:**

- Version: `"v0mimir1"`
- Is legacy: `true`

### Problem: Dropdown shows "Choose" instead of integration name

**Cause:** The current type (`slack_v0mimir1`) is not in dropdown options.

**Solution:** Already fixed! The dropdown now includes the currently selected type even if it's legacy.

---

## Backend Integration

### What Backend Needs to Provide

#### 1. Version Field in Notifiers API

**Endpoint:** `/api/alert-notifiers`

**Current response:**

```json
[
  { "name": "Slack", "type": "slack", "options": [...] }
]
```

**Required response:**

```json
[
  {
    "name": "Slack",
    "type": "slack",
    "version": "v1",
    "options": [...]
  },
  {
    "name": "Slack",
    "type": "slack_v0mimir1",
    "version": "v0mimir1",
    "options": [...]
  }
]
```

**Key points:**

- Different `type` for different versions
- `version` field indicates v1 / v0mimir1
- Backend determines which integrations have legacy versions

#### 2. Contact Points with Legacy Types

When contact points are imported from Mimir, they should have:

```json
{
  "name": "Imported Slack",
  "grafana_managed_receiver_configs": [
    {
      "type": "slack_v0mimir1", // ← Legacy type
      "settings": { "recipient": "#alerts" }
    }
  ]
}
```

#### 3. Templates with Version (Future)

**Endpoint:** `/api/alerting/notifications/templates` (or similar)

```json
[
  {
    "name": "my-template",
    "content": "...",
    "version": "v1" // ← or "v0mimir1"
  }
]
```

### Testing with Real Backend

When backend is ready:

1. **Remove POC enrichment** in `GrafanaReceiverForm.tsx`:

   ```typescript
   - const enrichedNotifiers = enrichNotifiersWithVersionsPOC(grafanaNotifiers);
   + // Backend now provides version field directly
   - const notifiers: Notifier[] = enrichedNotifiers.map((n) => {
   + const notifiers: Notifier[] = grafanaNotifiers.map((n) => {
   ```

2. **Delete POC file:**

   ```bash
   rm utils/notifier-versions-poc.ts
   ```

3. **Everything else stays the same!**
   - `ChannelSubForm.tsx` already handles versions correctly
   - `integration-versions.ts` helpers work with real data
   - UI badges and read-only state work automatically

---

## Migration to Production

### Phase 1: POC (Current) ✅

- [x] Type extensions (`version` field)
- [x] Helper utilities (`integration-versions.ts`)
- [x] POC mock data (`notifier-versions-poc.ts`)
- [x] UI implementation (badges, read-only, dropdown filtering)
- [x] Testing with mocks

### Phase 2: Backend Integration ⏳

- [ ] Backend returns `version` field in notifiers API
- [ ] Backend uses different types for versions (`slack` vs `slack_v0mimir1`)
- [ ] Remove POC enrichment function
- [ ] Test with real imported Mimir configurations

### Phase 3: Templates Versioning ⏳

- [ ] Backend returns `version` field in templates API
- [ ] Filter templates by integration version
- [ ] Visual badges for template versions
- [ ] Prevent v0 template creation via UI

### Phase 4: Conversion UI (Stage 3) ⏳

- [ ] Add "Convert to Latest Version" button
- [ ] Migration confirmation dialog
- [ ] Preserve settings during conversion
- [ ] Update integration type from v0mimir1 to v1

---

## Files Modified

### Core Implementation

- ✅ `types/alerting.ts` - Added `version` field to NotifierDTO
- ✅ `utils/integration-versions.ts` - Version metadata and helpers (NEW)
- ✅ `utils/notifier-versions-poc.ts` - POC mock data (NEW, temporary)
- ✅ `components/receivers/form/ChannelSubForm.tsx` - UI with badges and read-only state
- ✅ `components/receivers/form/GrafanaReceiverForm.tsx` - POC integration

### Testing

- ✅ `mocks/server/entities/alertmanager-config/grafana-alertmanager-config.ts` - Legacy contact points

### Documentation

- ✅ `POC_INTEGRATION_VERSIONING.md` - This file

### NOT Modified

- ❌ `components/receivers/form/CloudReceiverForm.tsx` - Cloud AM doesn't need versioning

---

## Next Steps

### Immediate (This Sprint)

1. ✅ **POC Complete** - Integration versioning working
2. ⏳ **Demo to Team** - Show working POC
3. ⏳ **Feedback** - Gather UX feedback

### Short Term (1-2 Weeks)

4. ⏳ **Backend Implementation** - Version field in notifiers API
5. ⏳ **Templates Versioning** - Similar pattern for templates
6. ⏳ **Integration Testing** - Test with real Mimir imports

### Medium Term (1-2 Months)

7. ⏳ **Conversion UI** - Stage 3 implementation
8. ⏳ **Routes (Two Trees)** - Show Grafana and Mimir routes separately
9. ⏳ **Time Intervals** - Similar versioning for time intervals

### Related GitHub Issues

- [#1113](https://github.com/grafana/alerting-squad/issues/1113) - Single Alertmanager (Epic)
- [#1153](https://github.com/grafana/alerting-squad/issues/1153) - Stage 2: Show Mimir Config in UI (Current)
- [#1154](https://github.com/grafana/alerting-squad/issues/1154) - Stage 3: Convert Mimir to Grafana
- [#1194](https://github.com/grafana/alerting-squad/issues/1194) - Expose Mimir receivers via K8s API
- [#1214](https://github.com/grafana/alerting-squad/issues/1214) - Versioned alerting notifications integrations (Epic)

---

## FAQ

### Q: Can users manually change the version?

**A:** Not in Stage 2 (current POC). In Stage 3, there will be a "Convert to Latest Version" button.

Currently, users can "convert" by changing the integration type (e.g., from Slack v0mimir1 to Email v1), but not upgrade within the same integration.

### Q: What happens to existing legacy integrations?

**A:** They continue to work and can be viewed, but:

- Cannot edit settings (read-only)
- Cannot create new ones
- Can be used in routes/rules (if already assigned)
- Will eventually be converted to v1

### Q: Will this affect existing contact points?

**A:** No. Existing contact points:

- Continue to work exactly as before
- Are treated as v1 (Grafana native)
- No migration required

### Q: Can I use legacy integrations in alert rules?

**A:** Yes, if already assigned. But you cannot _newly assign_ a legacy integration to a rule.

### Q: What if I need to edit a legacy integration urgently?

**A:** In Stage 2 (current), you cannot edit settings. Options:

1. Wait for Stage 3 (conversion UI)
2. Create a new v1 integration with same settings
3. Manual backend intervention (if critical)

### Q: Does this work for Cloud Alert Managers?

**A:** No. This is **only for Grafana Alert Manager**. Cloud/External Alert Managers (Prometheus, Mimir as datasource) are not affected.

---

## Contact

For questions about this POC:

- **Team:** Alerting Squad
- **Channel:** [#alerting-xl-single-alertmanager](https://raintank-corp.slack.com/archives/C08PSLT263E)
- **Design Doc:** [Migration of Mimir integrations to Grafana](https://docs.google.com/document/d/1kZ5uiNm0lqEPFUmG0ojlkbx7dYnGT2afcyucRdtLVOY/edit)

---

**Last Updated:** December 2024 (POC Phase 1 Complete)
