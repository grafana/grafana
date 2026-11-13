# Recently deleted Alert rules — Design (PR 1 of 2)

**Issue:** alerting-squad#2370 (part of #2296)  
**Plan doc:** [recently-deleted.md](https://github.com/grafana/alerting-squad/blob/gma-rules/frontend/gma-only-list/recently-deleted.md)

## Split

- **PR 1 (this spec)** — Shared infrastructure + Alert rules Recently deleted tab
- **PR 2** — Recording rules Recently deleted tab (#2371), consuming shared components from PR 1

---

## Routing & tabs

The existing `AlertRulesPage` gains a tab bar visible only to org Admins:

| Tab              | Route                                 |
| ---------------- | ------------------------------------- |
| Alert rules      | `/alerting/rules/alert` (existing)    |
| Recently deleted | `/alerting/rules/alert/deleted` (new) |

Non-admins see no tab bar and cannot reach `/alerting/rules/alert/deleted`.

---

## Architecture

```
AlertRulesPage
  ├── [Admin only] tab bar
  ├── /alerting/rules/alert        → existing AlertRulesBody (unchanged)
  └── /alerting/rules/alert/deleted → AlertRulesDeletedView
        ├── useDeletedAlertRules()   ← infinite query + local chunking
        ├── DeletedRulesTable        ← shared, reused by Recording rules PR
        ├── ReviewDrawer             ← shared read-only drawer
        └── RestoreModal             ← shared confirm + sanitize + create
```

**New files:**

| File                                    | Responsibility                                         |
| --------------------------------------- | ------------------------------------------------------ |
| `alert-rules/AlertRulesDeletedView.tsx` | Page component; wires query, table, drawer, modal      |
| `alert-rules/useDeletedAlertRules.ts`   | Infinite query with local 40-row chunking              |
| `deleted-rules/DeletedRulesTable.tsx`   | Shared table (Alert + Recording rows)                  |
| `deleted-rules/ReviewDrawer.tsx`        | Shared read-only rule preview + K8s JSON               |
| `deleted-rules/RestoreModal.tsx`        | Shared confirm modal                                   |
| `deleted-rules/useRestoreRule.ts`       | Shared sanitize payload + `useCreateAlertRuleMutation` |

Tests live alongside each file.

---

## Data layer

### Fetch

RTK infinite query using the generated `listAlertRule` endpoint:

```
GET /alertrules?labelSelector=grafana.app%2Fget-trash%3Dtrue&limit=40
```

`labelSelector`, `limit`, and `continue` are already supported by the generated client. The trash selector cannot be combined with other selectors — no title/folder filtering.

### Pagination normalization

Legacy storage ignores `limit` and returns the full tombstone set. Normalize without detecting storage mode:

1. First response arrives → take first 40, stash the remainder locally
2. **Load more** clicked → reveal next 40 from local stash (no network request)
3. Local stash exhausted + `metadata.continue` exists → fetch next server page
4. Local stash exhausted + no `metadata.continue` → list complete

No Refresh control. Route re-entry or reload starts from page 1.

### Secondary lookups

| Data         | Source                                                                       | Failure behavior                                 |
| ------------ | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| Folder path  | `rule.metadata.annotations['grafana.app/folder']` → `useFolderPath`          | Show folder UID                                  |
| Deleted by   | `rule.metadata.annotations['grafana.app/updatedBy']` → user display name API | Show user UID, or "Unknown" if annotation absent |
| Deleted time | `rule.metadata.deletionTimestamp`                                            | —                                                |

Failed secondary lookups affect only their own cell — the row remains usable.

---

## Table

Columns in order:

| Column         | Source                                                                                |
| -------------- | ------------------------------------------------------------------------------------- |
| **Title**      | `rule.spec.title`                                                                     |
| **Folder**     | Resolved path from folder annotation                                                  |
| **Deleted**    | `rule.metadata.deletionTimestamp` — absolute + relative ("Nov 10, 2026 · 3 days ago") |
| **Deleted by** | Resolved display name, UID fallback, or "Unknown"                                     |
| **Actions**    | Review button, Restore button                                                         |

**Page states:**

- Initial load: loading skeleton
- Empty: "No recently deleted rules found" empty state
- Error: inline error with Retry (keeps already-loaded rows, never shows empty state on failure)
- Load more failure: inline error with Retry below the loaded rows

---

## Review drawer

Read-only side drawer. Sections:

**Header**: title, folder path, deletion time, deleted by

**Configuration**:

- Paused state, evaluation interval
- Labels and annotations (excluding internal `grafana.*` keys)
- Expressions and query definitions
- Notification settings (if present)
- Dashboard link (if present)

**Advanced** (collapsible): sanitized Kubernetes JSON — strips `status`, `managedFields`, access annotations (`grafana.com/access/*`), and deletion metadata before displaying.

---

## Restore

### Flow

1. User clicks **Restore** → confirmation modal: 'Restore "{title}"?'
2. On confirm → sanitize payload → `useCreateAlertRuleMutation`
3. On success → invalidate trash query + show link to restored rule
4. On conflict (409) → "A rule with this name already exists."
5. On other failure → inline error in modal

### Sanitization

Before calling create, remove from the trash item:

- `deletionTimestamp`, `resourceVersion`, `status`, `managedFields`, `finalizers`
- All `grafana.com/access/*` annotations
- Provenance and manager ownership annotations (`grafana.com/provenance`, `grafana.app/managedBy`)
- Legacy group labels (`grafana.com/group`, `grafana.com/group-index`)

**Keep**: `metadata.name` (preserves UID in Unified Storage), folder annotation, full `spec`.

Disable the Restore button while the mutation is in flight to prevent duplicate submissions.

---

## Analytics

| Event               | Payload                                                             |
| ------------------- | ------------------------------------------------------------------- |
| Page view           | `itemCount` — number of items the API returned (not rows on screen) |
| Review opened       | —                                                                   |
| JSON section opened | —                                                                   |
| Restore attempt     | —                                                                   |
| Restore success     | —                                                                   |
| Restore failure     | `reason: 'conflict' \| 'other'`                                     |

No rule titles, UIDs, folder paths, user identifiers, or query content in any payload.

---

## Out of scope

- Permanently delete
- Search and filters
- Recording rules (PR 2 / #2371)
