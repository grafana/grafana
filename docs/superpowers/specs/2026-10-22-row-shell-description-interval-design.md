# Row Shell, Description Line, and Interval — Design Spec

**Date:** 2026-10-22
**Issue:** grafana/alerting-squad#2293 (PR 1 of 4)
**Branch:** `cb/gma-row-shell-description-interval`
**Depends on:** main (no dependency on Konrad's search PR #135675)

## Goal

Extend the GMA rule list rows with a description line (last error or summary annotation) and an interval indicator. This is the first of four PRs for issue #2293 — it covers only data already available from search, with no new per-row API calls.

## Scope

**In scope:**

- Add `description` and `right` slots to `RuleListItem`
- Add `annotations` and `interval` to both search queries and hit schemas
- `RuleDescription` component: last error (error color) or summary (secondary, Alert only) or nothing
- `RuleInterval` component: clock icon + duration string, "Evaluated every X" tooltip
- Both components added to `AlertRuleRow` and `RecordingRuleRow`

**Out of scope (later PRs):**

- Badge (plugin/provisioning) — requires full rule fetch per row
- Datasources, instance counts, labels, routing metadata
- Actions and Edit button

## Architecture

### 1. `RuleListItem` — new slots

Add two optional props:

```ts
description?: ReactNode  // renders between title and meta, absent = nothing
right?: ReactNode        // third column in outer Stack, never wraps, alignItems="center"
```

No CSS changes to the container. The `right` column uses `Stack alignItems="center" gap={1} wrap={false}`.

### 2. Search query additions

`alertRuleSearchQuery.ts` fields: add `'annotations'` and `'interval'`
`recordingRuleSearchQuery.ts` fields: add `'annotations'` and `'interval'`

### 3. Search hit schema additions

**`annotations`** comes back as a JSON-encoded string (`"JSON-encoded for display"` per CUE schema). Parse with a safe `tryParseAnnotations` helper that returns `Record<string, string> | undefined` on failure.

**`lastError`** is a direct string field (`status.lastError`).

**`interval`** is a direct string field (`spec.trigger.interval`, e.g. `"1m"`).

`AlertRuleSearchHit` additions:

```ts
summary?: string    // from parsed annotations['summary'], Alert only
lastError?: string  // from fields.lastError
interval?: string   // from fields.interval
```

`RecordingRuleSearchHit` additions:

```ts
lastError?: string
interval?: string
```

Zod schema additions (both hits):

```ts
lastError: z.string().optional().catch(undefined),
interval: z.string().optional().catch(undefined),
annotations: z.string().transform(tryParseAnnotations).optional().catch(undefined),
```

Alert hit transform extracts `summary` from the parsed annotations object. Recording hit ignores annotations content (no summary concept).

### 4. New shared components (`rule-row/`)

**`RuleDescription`**

```ts
interface RuleDescriptionProps {
  lastError?: string;
  summary?: string; // omit for recording rules
}
```

- `lastError` present → `Text variant="bodySmall" color="error" weight="light" truncate` wrapped in a `Tooltip`
- `lastError` absent, `summary` present → `Text variant="bodySmall" color="secondary" truncate` wrapped in a `Tooltip`
- Both absent → `null`

**`RuleInterval`**

```ts
interface RuleIntervalProps {
  interval?: string;
}
```

- `interval` present → `Tooltip content="Evaluated every {interval}"` wrapping `Icon name="clock-nine" size="xs"` + `Text variant="bodySmall" color="secondary"` with the interval string. `aria-label="Evaluated every {interval}"` on the wrapper.
- Absent → `null`

### 5. Row updates

**`AlertRuleRow`:**

```tsx
description={<RuleDescription lastError={hit.lastError} summary={hit.summary} />}
right={<RuleInterval interval={hit.interval} />}
```

**`RecordingRuleRow`:**

```tsx
description={<RuleDescription lastError={hit.lastError} />}
right={<RuleInterval interval={hit.interval} />}
```

## Testing

| File                                               | Coverage                                                                                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `rule-row/RuleListItem.test.tsx`                   | `description` renders between title and meta; `right` renders in right column; both absent → not rendered                          |
| `rule-row/RuleDescription.test.tsx`                | Error shown over summary; summary shown alone; both absent → null; text truncated; tooltip on hover                                |
| `rule-row/RuleInterval.test.tsx`                   | Renders clock + interval; tooltip "Evaluated every X"; accessible name; absent → null                                              |
| `alert-rules/alertRuleSearchHit.test.ts`           | `lastError`, `interval`, `summary` from valid annotations JSON; malformed annotations → summary absent; missing fields → undefined |
| `recording-rules/recordingRuleSearchHit.test.ts`   | `lastError`, `interval`; annotations field ignored for summary                                                                     |
| `alert-rules/alertRuleSearchQuery.test.ts`         | Fields array includes `annotations` and `interval`                                                                                 |
| `recording-rules/recordingRuleSearchQuery.test.ts` | Same                                                                                                                               |
| `alert-rules/AlertRuleRow.test.tsx`                | Description and interval render with hit data; absent when hit has none                                                            |
| `recording-rules/RecordingRuleRow.test.tsx`        | Same; no summary rendered                                                                                                          |

## Conflict note

Konrad's search PR (#135675) modifies `alertRuleSearchQuery.ts`. When that lands, reconcile by ensuring `annotations` and `interval` remain in the fields array alongside his additions.
