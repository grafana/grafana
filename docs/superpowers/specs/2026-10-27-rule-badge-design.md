# Plugin and Provisioning Badge in GMA-only Rule Rows — Design Spec

**Date:** 2026-10-27
**Issue:** grafana/alerting-squad#2313 (PR 4 of 4)
**Branch:** new branch from main (e.g. `cb/gma-rule-badge-2313`)
**Depends on:** grafana/grafana#136053 (PR 2 — labels + datasources) merged

## Goal

Add the plugin and provisioning badge after the rule title on both Alert and Recording rule rows. The badge is sourced from the full rule resource fetched per row via RTK Query. A failed fetch hides the badge silently — it never blocks row rendering.

## Scope

**In scope:**

- Plugin badge (`PluginOriginBadge`) when `spec.labels['__grafana_origin']` starts with `plugin/`
- Provisioning badge (`ProvisioningBadge`) when `grafana.com/provenance` annotation is set
- Plugin badge takes priority over provisioning badge when both apply
- Both Alert and Recording rule rows
- Full rule fetch per row, cached by RTK Query

**Out of scope:**

- Actions, Edit button (separate ticket)
- Instance counts, routing (PR 3)

## Architecture

### 1. Full rule fetch — in the entry components

The fetch happens in `AlertRuleListEntry` and `RecordingRuleListEntry` (already do the folder path lookup per row). Adding the rule fetch there keeps the rows presentation-only.

```tsx
// AlertRuleListEntry
const { data: fullRule } = useGetAlertRuleQuery({ name: hit.uid });

// RecordingRuleListEntry
const { data: fullRule } = useGetRecordingRuleQuery({ name: hit.uid });
```

RTK Query caches by UID. A failed request leaves `fullRule` undefined → `badge` is undefined → no badge rendered.

Imports:

- `useGetAlertRuleQuery` from `@grafana/api-clients/rtkq/rules.alerting/v0alpha1`
- `useGetRecordingRuleQuery` from `@grafana/api-clients/rtkq/rules.alerting/v0alpha1`

### 2. RuleBadge shared component (`rule-row/RuleBadge.tsx`)

Takes the full rule object (alert or recording — both have `spec.labels` and `metadata.annotations`) and returns the correct badge or null:

```tsx
interface RuleBadgeProps {
  rule: { spec?: { labels?: Record<string, string> }; metadata?: { annotations?: Record<string, string> } };
}

export function RuleBadge({ rule }: RuleBadgeProps) {
  const origin = rule.spec?.labels?.['__grafana_origin'];
  if (origin?.startsWith('plugin/')) {
    return <PluginOriginBadge pluginId={origin.slice('plugin/'.length)} size="sm" />;
  }
  if (isK8sEntityProvisioned(rule)) {
    const provenance = rule.metadata?.annotations?.['grafana.com/provenance'];
    return <ProvisioningBadge tooltip provenance={provenance} />;
  }
  return null;
}
```

Uses existing components:

- `PluginOriginBadge` from `plugins/PluginOriginBadge.tsx`
- `ProvisioningBadge` from `components/Provisioning.tsx`
- `isK8sEntityProvisioned` from `utils/k8s/utils.ts`

### 3. Title line placement — badge prop on row components

No changes to `RuleListItem`. Both row components accept an optional `badge?: ReactNode` prop. The `title` slot becomes a `Stack`:

```tsx
title={
  <Stack direction="row" alignItems="center" gap={0.5} wrap={false}>
    <TextLink id={titleId} href={...} color="primary" inline={false}>
      {searchHit.title}
    </TextLink>
    {badge}
  </Stack>
}
```

`badge` is absent while the full rule loads or when there is no badge to show.

### 4. Entry component changes

**`AlertRuleListEntry`** — add full rule fetch, compute badge, pass to row:

```tsx
export function AlertRuleListEntry({ searchHit }) {
  const folderPath = useFolderPath(searchHit.folderUid);
  const { data: fullRule } = useGetAlertRuleQuery({ name: searchHit.uid });
  const badge = fullRule ? <RuleBadge rule={fullRule} /> : undefined;

  return <AlertRuleRow searchHit={searchHit} folderPath={folderPath} badge={badge} />;
}
```

**`RecordingRuleListEntry`** — same pattern with `useGetRecordingRuleQuery`.

## Testing

| File                                              | Coverage                                                                                                                                                                                                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rule-row/RuleBadge.test.tsx`                     | Plugin badge shown when `__grafana_origin` starts with `plugin/`; plugin ID extracted correctly; provisioning badge shown when provenance set; plugin badge wins over provisioning; neither shown when both absent; `__grafana_origin` without `plugin/` prefix → no badge |
| `alert-rules/AlertRuleListEntry.test.tsx`         | Badge appears after full rule loads; no badge when full rule fetch fails; no badge while loading                                                                                                                                                                           |
| `recording-rules/RecordingRuleListEntry.test.tsx` | Same three cases for recording rules                                                                                                                                                                                                                                       |
| `alert-rules/AlertRuleRow.test.tsx`               | Update: `badge` prop renders inline after title                                                                                                                                                                                                                            |
| `recording-rules/RecordingRuleRow.test.tsx`       | Same                                                                                                                                                                                                                                                                       |
