# Labels and Datasources in GMA-only Rule Rows — Design Spec

**Date:** 2026-10-26
**Issue:** grafana/alerting-squad#2311 (PR 2 of 4)
**Branch:** `cb/rule-rows-ds-labels-2311`
**Depends on:** grafana/grafana#135824 (PR 1 — description + interval, merged 2026-10-23)

## Goal

Add labels pill and queried datasources metadata to both Alert and Recording rule rows. Add the Recording-specific "Records metric to" item. All data comes from search — no new per-row API calls.

## Scope

**In scope:**

- `labels` pill: `tag-alt` icon + "N labels" with `AlertLabels` tooltip. Private labels (`__grafana_origin`, `__*__`) excluded. Both rows.
- Queried datasources: logo + name link (single) or logos + "N data sources" (multiple). Both rows.
- "Records `metric` to" + target datasource logo + name link. Recording rows only, shown before queried datasources.

**Out of scope (later PRs):**

- Badge (plugin/provisioning), instance counts, routing, actions.

## Approach

**Option A (chosen):** `getDataSourceByUid` from Redux store for synchronous datasource lookup — names/logos already loaded at startup, no extra API calls. New `rule-row/` components for shared items, `recording-rules/` for the Recording-specific item. Labels parsed in the hit mapper.

## Architecture

### 1. Search query additions

`alertRuleSearchQuery.ts` fields: add `'labels'`, `'datasourceUIDs'`

`recordingRuleSearchQuery.ts` fields: add `'labels'`, `'datasourceUIDs'`, `'metric'`, `'targetDatasourceUID'`

### 2. Search hit schema additions

`labels` comes back as `string[]` — entries are `"key"` (exists) or `"key=value"`. Parse only `"key=value"` entries into `Record<string, string>`, filter out private keys via `isPrivateLabelKey` from `utils/labels.ts`.

`datasourceUIDs` comes back as `string[]` — stored as-is.

`metric` and `targetDatasourceUID` are direct string fields (Recording only).

**`AlertRuleSearchHit` additions:**

```ts
labels?: Labels           // parsed from string[], private keys filtered
datasourceUIDs?: string[]
```

**`RecordingRuleSearchHit` additions:**

```ts
labels?: Labels
datasourceUIDs?: string[]
metric?: string
targetDatasourceUID?: string
```

Zod schema additions (alert):

```ts
labels: z.array(z.string()).optional().catch(undefined),
datasourceUIDs: z.array(z.string()).optional().catch(undefined),
```

Alert hit transform parses labels:

```ts
labels: parseSearchLabels(fields.labels),
datasourceUIDs: fields.datasourceUIDs,
```

Recording adds:

```ts
metric: z.string().optional().catch(undefined),
targetDatasourceUID: z.string().optional().catch(undefined),
```

`parseSearchLabels` helper — defined once in `alertRuleSearchHit.ts` and exported for reuse in recording:

```ts
function parseSearchLabels(entries?: string[]): Labels | undefined {
  if (!entries?.length) return undefined;
  const result: Labels = {};
  for (const entry of entries) {
    const eq = entry.indexOf('=');
    if (eq > 0) {
      const key = entry.slice(0, eq);
      if (!isPrivateLabelKey(key)) {
        result[key] = entry.slice(eq + 1);
      }
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
```

### 3. New shared components (`rule-row/`)

**`RuleDatasources`**

```ts
interface RuleDatasourcesProps {
  datasourceUIDs: string[];
}
```

- Calls `getDataSourceByUid` for each UID (synchronous, Redux store)
- Single resolved source → `DataSourceLogo` + `TextLink` with name to `makeDataSourceLink(uid)`
- Multiple resolved sources → each `DataSourceLogo` wrapped in a `Tooltip` with the name + `Text` "N data sources"
- All unresolved or empty → `null`
- Uses `t()` for the "N data sources" string

**`RuleLabels`**

```ts
interface RuleLabelsProps {
  labels: Labels;
}
```

- `Icon name="tag-alt" size="xs"` + `Text` "N labels" (via `labelsSize`)
- `Tooltip` with `AlertLabels` component on hover/focus
- Zero labels → `null`
- Uses `t()` for the label count string

### 4. New Recording-specific component (`recording-rules/`)

**`RuleRecordedMetric`**

```ts
interface RuleRecordedMetricProps {
  metric: string;
  targetDatasourceUID: string;
}
```

- "Records `metric` to" + `DataSourceLogo` + `TextLink` with datasource name to `makeDataSourceLink(targetDatasourceUID)`
- If datasource not found: "Records `metric` to `targetDatasourceUID`" (UID as fallback text)

### 5. Row wiring

**`AlertRuleRow`** meta items (folder path already first):

```tsx
datasourceUIDs && datasourceUIDs.length > 0 && <RuleDatasources key="ds" datasourceUIDs={datasourceUIDs} />,
labels && labelsSize(labels) > 0 && <RuleLabels key="labels" labels={labels} />,
```

**`RecordingRuleRow`** meta items:

```tsx
metric && targetDatasourceUID && <RuleRecordedMetric key="metric" metric={metric} targetDatasourceUID={targetDatasourceUID} />,
datasourceUIDs && datasourceUIDs.length > 0 && <RuleDatasources key="ds" datasourceUIDs={datasourceUIDs} />,
labels && labelsSize(labels) > 0 && <RuleLabels key="labels" labels={labels} />,
```

## Testing

| File                                          | Coverage                                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `alertRuleSearchQuery.test.ts`                | Fields include `labels`, `datasourceUIDs`                                                                  |
| `recordingRuleSearchQuery.test.ts`            | Fields include `labels`, `datasourceUIDs`, `metric`, `targetDatasourceUID`                                 |
| `alertRuleSearchHit.test.ts`                  | Parses `key=value` labels, filters private keys, stores `datasourceUIDs` as-is, ignores `key`-only entries |
| `recordingRuleSearchHit.test.ts`              | Same + `metric` and `targetDatasourceUID` read directly                                                    |
| `rule-row/RuleDatasources.test.tsx`           | Single source → logo + link; multiple → logos + "N data sources"; empty/unresolved → null                  |
| `rule-row/RuleLabels.test.tsx`                | Shows count + tooltip; zero labels → null                                                                  |
| `recording-rules/RuleRecordedMetric.test.tsx` | Renders "Records X to" + datasource name link; unresolved UID → UID fallback                               |
| `alert-rules/AlertRuleRow.test.tsx`           | Datasources and labels render with hit data; absent when empty                                             |
| `recording-rules/RecordingRuleRow.test.tsx`   | Same + recorded metric renders; absent when missing                                                        |
