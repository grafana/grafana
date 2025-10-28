# POC: Integration Versioning for Single Alert Manager

## Overview

This POC demonstrates the frontend implementation of integration versioning to support the migration from Mimir Alert Manager to a unified **Grafana Alert Manager**.

⚠️ **IMPORTANT:** This is ONLY for **Grafana Alert Manager** receivers, NOT for Cloud/External Alert Managers.

## Problem Statement

When migrating from Mimir to Grafana Alert Manager, we need to support:

1. **Multiple versions** of the same integration (e.g., Slack v0 from Mimir, Slack v1 from Grafana)
2. **Legacy integrations** that should be maintained but not created
3. **Seamless user experience** where version complexity is minimized

## Implementation

### 1. Type Extensions

**File:** `types/alerting.ts`

Extended `NotifierDTO` interface with:

```typescript
version?: string;       // e.g., "v0" (legacy/mimir), "v1" (grafana)
deprecated?: boolean;   // indicates if this is a legacy version
canCreate?: boolean;    // indicates if new instances can be created
```

### 2. POC Utilities

**File:** `utils/notifier-versions-poc.ts`

This file contains utilities to simulate backend support:

- `enrichNotifiersWithVersionsPOC()` - Creates legacy (v0) versions of selected integrations
- `groupNotifiersByName()` - Groups notifiers by base name for version management
- `filterNotifiersForContext()` - Filters based on create vs. edit context
- `getLatestVersions()` - Returns only the latest creatable versions

**Integrations with legacy versions:**

- Slack
- Webhook
- Email
- Telegram
- Discord

### 3. UI Changes

**File:** `components/receivers/form/ChannelSubForm.tsx`

#### Dropdown Filtering

- **When creating:** Only shows latest (v1) versions
- **When editing:** Shows all versions including legacy

#### Visual Indicators

- Legacy integrations display an **orange badge** with "Legacy (Mimir) - Read Only" label
- Badge includes warning icon and descriptive tooltip
- **Info alert** displayed at the top explaining read-only state

#### Read-Only Behavior (Stage 2)

- **All form fields are disabled** for legacy integrations
- Integration type dropdown is disabled
- Settings fields are read-only
- Notification settings are read-only
- User cannot edit until conversion (Stage 3)

### 4. Form Integration

**File:** `components/receivers/form/GrafanaReceiverForm.tsx` (**ONLY**)

Enriches notifiers with version information before passing to the form.

**Note:** `CloudReceiverForm.tsx` is **NOT modified** because:

- Cloud/External Alert Managers (Prometheus, Mimir as datasource) don't need this versioning
- This is specific to the unified Grafana Alert Manager migration
- Cloud receivers continue to work as before

## How to Test the POC

### 1. Creating a New Contact Point

1. Navigate to **Alerting > Contact points**
2. Click **"New contact point"**
3. Open the **Integration** dropdown
4. **Expected:** You will see only the latest versions (no duplicates)
5. **Expected:** You will NOT see any "Legacy (Mimir)" badges

### 2. Editing an Existing Contact Point (Simulating Legacy)

To simulate editing a contact point with a legacy integration:

1. You need to temporarily modify the code to create a legacy integration
2. Or create a contact point with type `slack_v0`, `webhook_v0`, etc.

**Once you have a legacy integration:**

1. Navigate to edit that contact point
2. **Expected:** Next to the Integration dropdown, you'll see an orange badge saying "Legacy (Mimir)"
3. **Expected:** Tooltip explains this is a legacy version
4. If you change to another integration and back, you'll only see the latest versions available

### 3. Console Inspection

Open browser console and check:

- Notifiers array should contain both v0 and v1 versions for selected integrations
- Look for notifiers with `version: "v0"` and `deprecated: true`

## Key Behaviors

### Creating New Integrations

- ✅ Only latest versions appear in dropdown
- ✅ No legacy versions can be selected
- ✅ No duplicate integration names

### Editing Existing Integrations

- ✅ All versions are available (including legacy)
- ✅ Legacy versions show visual indicator
- ✅ User cannot change version directly (would need "convert" action in Stage 3)

### Version Metadata

- **v1 (Grafana):** `version: "v1"`, `deprecated: false`, `canCreate: true`
- **v0 (Mimir/Legacy):** `version: "v0"`, `deprecated: true`, `canCreate: false`

## Backend Integration Requirements

When backend is ready, replace the POC logic:

### 1. Remove POC Enrichment

In `GrafanaReceiverForm.tsx`, remove:

```typescript
const enrichedNotifiers = enrichNotifiersWithVersionsPOC(grafanaNotifiers);
```

And use `grafanaNotifiers` directly.

### 2. Backend API Changes

The `/api/alert-notifiers` endpoint should return:

```json
[
  {
    "name": "Slack",
    "type": "slack",
    "version": "v1",
    "deprecated": false,
    "canCreate": true,
    "options": [...]
  },
  {
    "name": "Slack",
    "type": "slack_v0",
    "version": "v0",
    "deprecated": true,
    "canCreate": false,
    "options": [...]
  }
]
```

### 3. Type Differentiation

- Latest version: Use standard type name (e.g., `"slack"`)
- Legacy version: Use suffixed type name (e.g., `"slack_v0"`)

This ensures the frontend can distinguish between versions.

## Staged Rollout Plan

### Stage 1: Import (STAGED)

- Mimir configurations imported and saved in DB
- Grafana runs both configurations merged
- **Frontend:** No changes needed yet

### Stage 2: Read-Only Display (CURRENT POC)

- Imported integrations shown as provisioned/read-only
- Legacy versions visible with badges
- **Frontend:** This POC implements Stage 2

### Stage 3: Conversion

- User converts imported config to editable
- Version migration UI
- **Frontend:** Future work - add "Convert" button and migration flow

## Files Modified

1. ✅ `types/alerting.ts` - Type extensions
2. ✅ `utils/notifier-versions-poc.ts` - POC utilities (NEW)
3. ✅ `components/receivers/form/ChannelSubForm.tsx` - UI changes (used by both forms)
4. ✅ `components/receivers/form/GrafanaReceiverForm.tsx` - Integration (**Grafana AM only**)

**NOT modified:**

- ❌ `components/receivers/form/CloudReceiverForm.tsx` - Cloud Alert Managers don't need versioning

## Demo Script for Team

### Script 1: Show Version Filtering

```
1. Open Contact Points page
2. Click "New contact point"
3. Show the Integration dropdown
4. Point out: No duplicates, only latest versions
5. Show browser console with enriched notifiers
```

### Script 2: Show Legacy Badge (Requires Setup)

```
1. Temporarily edit data to simulate legacy integration
2. Edit a contact point with legacy integration
3. Show the orange "Legacy (Mimir)" badge
4. Hover to show tooltip
```

### Script 3: Explain Backend Contract

```
1. Show the POC utilities file
2. Explain what backend needs to return
3. Show the NotifierDTO type extensions
4. Discuss migration path to remove POC code
```

## Templates Versioning (Additional Requirement)

### Background

Per design decision: **Templates are also versioned** and must match integration versions:

- **Mimir templates (v0)** → Can only be used in **v0 integrations**
- **Grafana templates (v1)** → Can only be used in **v1 integrations**

### Impact on Frontend

1. **Template Selector / Autocomplete**
   - Must filter available templates based on current integration version
   - If editing Slack v0 → only show v0 templates
   - If editing Slack v1 → only show v1 templates

2. **Template Definition Page**
   - Must display template version (v0 or v1)
   - Visual indicator similar to integration badges

3. **Backend Requirements**
   - Templates API must return version information
   - v0 templates cannot be created via regular API (only via import)

### Files to Modify (Future Work)

- `components/receivers/form/fields/TemplateSelector.tsx` - Filter templates by version
- `components/receivers/form/fields/TemplateContentAndPreview.tsx` - Show version badge
- Template definition pages - Display version information

### Not Included in Current POC

This POC focuses on **integration versioning only**. Template versioning will be implemented in a follow-up phase.

---

## Next Steps

1. ✅ Frontend POC complete (integrations versioning)
2. ⏳ Backend implements version metadata in notifier endpoints
3. ⏳ Backend implements version metadata in templates API
4. ⏳ Frontend implements template filtering by version
5. ⏳ Test with real Mimir imported configurations
6. ⏳ Implement Stage 3: Conversion UI
7. ⏳ Add telemetry for version usage

## Questions?

- **Q:** Can users manually change the version?
- **A:** No. In Stage 2, they see the version but cannot change it. Stage 3 will add "Convert/Upgrade" action.

- **Q:** What happens to existing legacy integrations?
- **A:** They continue to work and can be edited, but you cannot create new ones.

- **Q:** Will this affect existing contact points?
- **A:** No. Existing contact points continue to work. They'll show as v1 (Grafana) by default.

## Contact

For questions about this POC, contact the Alerting team.
