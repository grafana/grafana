# Rule actions design — Alert and Recording rules pages

**Issue:** alerting-squad#2298  
**Plan doc:** [rule-pages.md#rule-actions](https://github.com/grafana/alerting-squad/blob/gma-rules/frontend/gma-only-list/rule-pages.md#rule-actions)

## Split

- **PR 1** — Shared infrastructure + Alert rule row/header actions
- **PR 2** — Recording rule row/header actions (consumes PR 1's shared parts)

---

## Architecture

`AlertRuleListEntry` already fetches the full rule for the badge. It instantiates `<AlertRuleActions>` and passes it to `AlertRuleRow` as an `actions` prop, which renders it in the `right` slot alongside the interval. `AlertRuleRow` remains purely presentational.

```
AlertRuleListEntry
  ├── useFolderPath()
  ├── useGetAlertRuleQuery()       ← already exists; now also drives permissions + actions
  ├── <AlertRuleRow actions={<AlertRuleActions rule={fullRule} searchHit={searchHit} />} />
  └── <AlertRuleActions>           ← owns all action state (drawers, confirm dialog)
```

`RecordingRuleListEntry` follows the same pattern with `useGetRecordingRuleQuery` and `<RecordingRuleActions>`.

---

## Permission gating

Permissions come from annotations on the full rule resource — no extra fetch needed.

```ts
function getRulePermissions(rule: AlertRule | RecordingRule | undefined) {
  if (rule === undefined) {
    return { canEdit: false, canPause: false, canDelete: false, canDuplicate: false, isLoading: true };
  }
  const canWrite = getAnnotation(rule, K8sAnnotations.AccessWrite) === 'true';
  const canDelete = getAnnotation(rule, K8sAnnotations.AccessDelete) === 'true';
  const isProvisioned = isK8sEntityProvisioned(rule);
  const isPlugin = !!getRulePluginOrigin({ labels: rule.spec?.labels });
  const isManaged = !!rule.metadata?.annotations?.['grafana.app/managedBy'];
  const restricted = isProvisioned || isPlugin || isManaged;

  return {
    canEdit: canWrite && !restricted,
    canPause: canWrite && !restricted,
    canDelete: canDelete && !restricted,
    canDuplicate: true,
    isLoading: false,
  };
}
```

**While loading** (`isLoading: true`): Edit and More are rendered but disabled ("Checking" state).  
**After loading**: Actions the user cannot perform are **removed** entirely (not disabled).  
**No `returnTo`** on any action link.

`getAnnotation`, `isK8sEntityProvisioned`, and `getRulePluginOrigin` all exist in `utils/k8s/utils.ts` and `utils/rules.ts`.

---

## Alert rule row actions

### Visibility

Always visible. Not hover-only.

### Right slot layout

```
[interval]  [Edit]  [More ▾]
```

Edit is a `LinkButton`. More is `MoreButton` + `Menu` from `@grafana/ui`. Both are `disabled` while loading. After loading, each is removed if the user has no permission.

### Actions

| Action                           | Condition                                                                          | Behavior                                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Edit**                         | `canEdit`                                                                          | `LinkButton` → `/alerting/grafana/{uid}/edit`                                                                                                                |
| **More → View**                  | always                                                                             | `/alerting/grafana/{uid}/view`                                                                                                                               |
| **More → Duplicate**             | `canDuplicate`                                                                     | Copy route. For provisioned/managed rules, show "Copy provisioned alert rule" confirm first                                                                  |
| **More → Copy link**             | always                                                                             | Absolute canonical URL (the View URL) → clipboard; report success and failure                                                                                |
| **More → Pause / Resume**        | `canPause`                                                                         | `PATCH /alertrules/{uid}` with `application/strategic-merge-patch+json` and `{ "spec": { "paused": true/false } }`; disabled while saving; revert on failure |
| **More → Delete**                | `canDelete`                                                                        | Confirm 'Delete "{title}"?'; on confirm `DELETE /alertrules/{uid}`; row removed on success; error shown on failure; stays on list                            |
| **More → Analyze**               | `isAssistantAvailable`                                                             | Pass loaded `AlertRule` to existing `AnalyzeRuleButton` (`alertRule` prop)                                                                                   |
| **More → Silence notifications** | silence ability                                                                    | Open `SilenceGrafanaRuleDrawer` with `__alert_rule_uid__=<uid>` matcher                                                                                      |
| **More → Manage enrichments**    | `alertEnrichment` + `alertingEnrichmentPerRule` flags AND `alert.enrichments:read` | Open enrichment drawer with rule UID; **hidden** (not disabled) when unavailable                                                                             |

**Deferred (out of scope):** Declare incident, Export.

---

## Alert rule header actions

- **New alert rule** (primary) — gated on create permission → `/alerting/new/grafana`
- **Generate with AI** — enterprise component slot; shown when registered and create permission exists; renders nothing when no component registered
- **More → Design rule for provisioning** — opens existing design/export form

---

## Recording rule row actions

Same pattern as Alert rules. `RecordingRuleListEntry` passes `<RecordingRuleActions rule={fullRule} searchHit={searchHit} />` to `RecordingRuleRow` as `actions`.

Permissions use the same `getRulePermissions` helper with `RecordingRule` as the type.

| Action                    | Condition              | Behavior                                                                  |
| ------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| **Edit**                  | `canEdit`              | `LinkButton` → `/alerting/grafana/{uid}/edit`                             |
| **More → View**           | always                 | `/alerting/grafana/{uid}/view`                                            |
| **More → Duplicate**      | `canDuplicate`         | Same as alert; confirm modal for provisioned/managed                      |
| **More → Copy link**      | always                 | Canonical URL → clipboard                                                 |
| **More → Pause / Resume** | `canPause`             | `PATCH /recordingrules/{uid}` with same strategic-merge-patch body        |
| **More → Delete**         | `canDelete`            | Same confirm; `DELETE /recordingrules/{uid}`; stays on list               |
| **More → Analyze**        | `isAssistantAvailable` | Pass loaded `RecordingRule` to `AnalyzeRuleButton` (`recordingRule` prop) |

No Silence, Declare incident, or Manage enrichments on Recording rules.

---

## Recording rule header actions

- **New recording rule** (primary only) — gated on create permission → `/alerting/new/grafana-recording`
- No More menu, no Generate with AI

---

## Shared components (PR 1 builds, PR 2 consumes)

| Component / Hook           | Responsibility                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `getRulePermissions(rule)` | Reads access annotations, detects provisioned/plugin/managed; exported from a new `rule-row/rulePermissions.ts` |
| `useDeleteAlertRule()`     | Confirmation dialog state + `useDeleteAlertRuleMutation`; invalidates RTK tags                                  |
| `usePauseAlertRule()`      | `usePartialUpdateAlertRuleMutation` (strategic merge patch); loading + error state                              |
| `useDeleteRecordingRule()` | Same pattern for recording rules                                                                                |
| `usePauseRecordingRule()`  | Same pattern for recording rules                                                                                |
| `AlertRuleActions`         | Edit button + More dropdown with all alert-specific items and drawer state                                      |
| `RecordingRuleActions`     | Edit button + More dropdown with recording-specific items                                                       |

---

## Files changed (approximate)

**PR 1:**

- `rule-row/rulePermissions.ts` — new helper
- `alert-rules/AlertRuleActions.tsx` + test
- `alert-rules/AlertRuleListEntry.tsx` — wire actions prop
- `alert-rules/AlertRuleRow.tsx` — add `actions` prop to `right` slot
- `alert-rules/AlertRuleRow.test.tsx` — add action cases
- `alert-rules/AlertRulesPage.tsx` — header actions

**PR 2:**

- `recording-rules/RecordingRuleActions.tsx` + test
- `recording-rules/RecordingRuleListEntry.tsx` — wire actions prop
- `recording-rules/RecordingRuleRow.tsx` — add `actions` prop
- `recording-rules/RecordingRulesPage.tsx` — header actions

---

## Out of scope

- Declare incident (deferred — needs stable Alert state from new API)
- Export (deferred — format decision pending)
- Bulk actions
- Export all
- Evaluation-group actions or navigation
- `returnTo` on any link
