# K8s Dashboard Resource Annotations Analysis

This document catalogs every annotation that can exist on a dashboard k8s resource (`dashboard.grafana.app`), traces where each is set/consumed, and assesses which can be removed.

---

## Summary Table

| #   | Annotation Key                                | Constant                              | Category             | Can Remove?         | Replacement Strategy                                                                  |
| --- | --------------------------------------------- | ------------------------------------- | -------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| 1   | `grafana.app/createdBy`                       | `AnnoKeyCreatedBy`                    | Core metadata        | **No**              | Already maps to standard audit info; keep as annotation                               |
| 2   | `grafana.app/updatedTimestamp`                | `AnnoKeyUpdatedTimestamp`             | Core metadata        | **Yes**             | Move to `status` subresource or use `metadata.managedFields`                          |
| 3   | `grafana.app/updatedBy`                       | `AnnoKeyUpdatedBy`                    | Core metadata        | **Yes**             | Move to `status` subresource or use `metadata.managedFields`                          |
| 4   | `grafana.app/folder`                          | `AnnoKeyFolder`                       | Core metadata        | **Yes**             | Move to a label, or a dedicated `spec` field, or use k8s namespace hierarchy          |
| 5   | `grafana.app/blob`                            | `AnnoKeyBlob`                         | Storage impl. detail | **Yes**             | Move to `status` subresource; this is server-side state                               |
| 6   | `grafana.app/message`                         | `AnnoKeyMessage`                      | Input-only           | **Yes (partially)** | Already stripped on read; could become a query parameter or request header            |
| 7   | `grafana.app/grant-permissions`               | `AnnoKeyGrantPermissions`             | Input-only           | **Yes**             | Already stripped before storage; should become a query parameter or separate API call |
| 8   | `grafana.app/managedBy`                       | `AnnoKeyManagerKind`                  | Manager props        | **No**              | Reasonable use of annotation for external tooling metadata                            |
| 9   | `grafana.app/managerId`                       | `AnnoKeyManagerIdentity`              | Manager props        | **No**              | Reasonable use of annotation for external tooling metadata                            |
| 10  | `grafana.app/managerAllowsEdits`              | `AnnoKeyManagerAllowsEdits`           | Manager props        | **No**              | Reasonable use of annotation for external tooling metadata                            |
| 11  | `grafana.app/managerSuspended`                | `AnnoKeyManagerSuspended`             | Manager props        | **No**              | Reasonable use of annotation for external tooling metadata                            |
| 12  | `grafana.app/sourcePath`                      | `AnnoKeySourcePath`                   | Source props         | **No**              | Reasonable use of annotation for provisioning source tracking                         |
| 13  | `grafana.app/sourceChecksum`                  | `AnnoKeySourceChecksum`               | Source props         | **No**              | Reasonable use of annotation for provisioning source tracking                         |
| 14  | `grafana.app/sourceTimestamp`                 | `AnnoKeySourceTimestamp`              | Source props         | **No**              | Reasonable use of annotation for provisioning source tracking                         |
| 15  | `grafana.app/fullpath`                        | `AnnoKeyFullpath`                     | Legacy shim          | **Yes**             | Legacy modes 0-2 only; should be resolved via folder API lookup                       |
| 16  | `grafana.app/fullpathUIDs`                    | `AnnoKeyFullpathUIDs`                 | Legacy shim          | **Yes**             | Legacy modes 0-2 only; should be resolved via folder API lookup                       |
| 17  | `grafana.app/saved-from-ui`                   | `AnnoKeySavedFromUI`                  | Client audit         | **Yes**             | Move to commit message or `grafana.app/message`; not useful as persisted annotation   |
| 18  | `grafana.app/slug`                            | `AnnoKeySlug`                         | FE-only shim         | **Yes**             | Already deprecated; compute client-side from title                                    |
| 19  | `grafana.app/dashboard-is-snapshot`           | `AnnoKeyDashboardIsSnapshot`          | FE-only shim         | **Yes**             | Already deprecated; determine from resource type (Snapshot vs Dashboard)              |
| 20  | `grafana.app/dashboard-snapshot-original-url` | `AnnoKeyDashboardSnapshotOriginalUrl` | FE-only shim         | **Yes**             | Already deprecated; move to snapshot spec                                             |
| 21  | `grafana.app/dashboard-gnet-id`               | `AnnoKeyDashboardGnetId`              | FE-only shim         | **Yes**             | Already deprecated; move to `spec` or `status`                                        |
| 22  | `grafana.app/folderTitle`                     | `AnnoKeyFolderTitle`                  | FE-only shim         | **Yes**             | Already deprecated; resolved from folder API via `grafana.app/folder` UID             |
| 23  | `grafana.app/folderUrl`                       | `AnnoKeyFolderUrl`                    | FE-only shim         | **Yes**             | Already deprecated; resolved from folder API via `grafana.app/folder` UID             |
| 24  | `grafana.app/embedded`                        | `AnnoKeyEmbedded`                     | FE-only shim         | **Yes**             | Already deprecated; should be a scene/context flag, not persisted                     |
| 25  | `grafana.app/reloadOnParamsChange`            | `AnnoReloadOnParamsChange`            | Experimental         | **Yes**             | Experimental, will be removed; should be feature flag + proxy behavior                |
| 26  | `grafana.app/deprecatedInternalID`            | `LabelKeyDeprecatedInternalID`        | Legacy (label)       | **Yes**             | Already deprecated; scheduled for removal in Grafana 13                               |
| 27  | `grafana.app/originName`                      | (none, legacy)                        | Legacy               | **Yes**             | Superseded by manager/source properties                                               |
| 28  | `grafana.app/originPath`                      | (none, legacy)                        | Legacy               | **Yes**             | Superseded by manager/source properties                                               |
| 29  | `grafana.app/originHash`                      | (none, legacy)                        | Legacy               | **Yes**             | Superseded by manager/source properties                                               |

---

## Detailed Analysis

### Category 1: Core Metadata Annotations (Server-Managed)

These are set/maintained by the unified storage layer in `pkg/storage/unified/apistore/prepare.go`.

#### 1. `grafana.app/createdBy`

- **Set by**: Storage layer on CREATE (`prepare.go:138`)
- **Read by**: Frontend display, DTO responses, history tracking
- **Verdict**: **Keep.** This is audit metadata. While `metadata.managedFields` in k8s tracks who modified fields, `createdBy` provides simple "who created this" semantics. A case could be made to move this to `status`, but it's a reasonable annotation.

#### 2. `grafana.app/updatedTimestamp`

- **Set by**: Storage layer on UPDATE (`prepare.go:231`), on DELETE (`server.go:984`), legacy SQL layer
- **Read by**: Frontend display, sorting, history
- **Verdict**: **Can be removed.** Kubernetes already tracks modification timestamps indirectly through `resourceVersion` and `metadata.managedFields`. This duplicates information. Can be moved to:
  - `status.lastUpdated` — server-managed timestamp in the status subresource
  - Derived from `metadata.managedFields[].time` — standard k8s field-level timestamps
  - Derived from the storage layer's resource version metadata

#### 3. `grafana.app/updatedBy`

- **Set by**: Storage layer on UPDATE (`prepare.go:230`), on DELETE (`server.go:987`), legacy SQL layer
- **Read by**: Frontend display, audit
- **Verdict**: **Can be removed.** Same reasoning as `updatedTimestamp`. Can be moved to:
  - `status.lastUpdatedBy` — server-managed field in the status subresource
  - Derived from `metadata.managedFields[].manager` — standard k8s field-level tracking

#### 4. `grafana.app/folder`

- **Set by**: Frontend on CREATE/UPDATE, legacy SQL layer, provisioning
- **Read by**: Storage layer (folder move detection), DTO connector, search, permissions, frontend
- **Verdict**: **Can be removed as an annotation.** The folder is a fundamental organizational property, not supplementary metadata. Options:
  - **Label** (`grafana.app/folder`): Labels are indexable and queryable via label selectors, which is better for search/filtering. However, labels have strict value constraints (63 chars, alphanumeric).
  - **Dedicated `spec` field**: Add `folder` to the spec, making it explicit schema. This changes the generation on folder move though.
  - **Namespace mapping**: If folders become namespaces, this becomes implicit. Not practical for nested folders.
  - **Recommended**: Move to a **label** since folder UID values meet label constraints and labels are designed for organizational grouping.

#### 5. `grafana.app/blob`

- **Set by**: Large object support layer (`large.go`, `prepare.go:147`)
- **Read by**: DTO connector for reconstruction (`sub_dto.go:108`)
- **Verdict**: **Can be removed.** This is an internal storage implementation detail (pointer to blob storage when dashboard JSON exceeds the threshold). Users should never see or care about this. Can be moved to:
  - `status.blobRef` — server-managed state in the status subresource
  - Internal storage metadata not exposed in the resource at all

#### 6. `grafana.app/message`

- **Set by**: Frontend on save (commit message)
- **Read by**: Legacy storage layer for save operations, validation
- **Verdict**: **Can be partially removed.** The message is an input-only field (save commit message). It is stored in the resource history but does not need to be on the live resource as an annotation. Options:
  - **Request header** (e.g., `X-Grafana-Message`): Cleaner separation of concerns
  - **Query parameter** on PUT/POST: `?message=...`
  - Keep as annotation but document that it's input-only and may not appear on GET responses

#### 7. `grafana.app/grant-permissions`

- **Set by**: Frontend on CREATE
- **Read by**: Storage layer, then immediately stripped (`prepare.go:112-114`)
- **Verdict**: **Should be removed.** This is never persisted — it's an input-only side-channel. Validated and removed before storage. Should become:
  - **Query parameter**: `?grantPermissions=default`
  - **Request header**: `X-Grafana-Grant-Permissions: default`
  - **Separate API call**: POST to a permissions endpoint after creation

---

### Category 2: Manager/Source Properties (External Tooling)

These annotations follow standard Kubernetes patterns for external tooling metadata.

#### 8-11. Manager Properties (`managedBy`, `managerId`, `managerAllowsEdits`, `managerSuspended`)

- **Set by**: Provisioning, repo sync, terraform, kubectl
- **Read by**: Write guards (prevent UI edits to repo-managed resources), frontend display
- **Verdict**: **Keep.** These follow standard k8s annotation patterns for external controller/operator metadata (similar to `app.kubernetes.io/managed-by`). They describe _who manages this resource_ which is classic annotation territory.

#### 12-14. Source Properties (`sourcePath`, `sourceChecksum`, `sourceTimestamp`)

- **Set by**: Provisioning/repo sync
- **Read by**: Sync reconciliation, conflict detection
- **Verdict**: **Keep.** These track the external source of truth for provisioned resources. Annotations are the right place for this metadata (similar to GitOps annotation patterns like ArgoCD's `argocd.argoproj.io/tracking-id`).

---

### Category 3: Legacy/Compatibility Shims

#### 15-16. Fullpath Annotations (`fullpath`, `fullpathUIDs`)

- **Set by**: Legacy SQL folder storage (`conversions.go:85-89`), only in modes 0-2
- **Read by**: Folder service, alerting access control
- **Verdict**: **Remove.** These exist only for legacy storage modes. The fullpath should be resolved by walking the folder tree via the folder API, not embedded in every resource. When legacy modes are removed, these become unnecessary.
  - **Replacement**: Client-side or server-side resolution via the folder API using the `grafana.app/folder` UID

#### 17. `grafana.app/saved-from-ui`

- **Set by**: Frontend ScopedResourceClient (`client.ts:169`) — stamps the Grafana build version
- **Read by**: Not read by backend; only appears in persisted resources
- **Verdict**: **Remove.** This is audit/debugging information that bloats every saved resource. Better alternatives:
  - Include in the `grafana.app/message` commit message
  - Store as part of the resource version history metadata (server-side)
  - Use a request header (`User-Agent` already contains this info)

#### 18. `grafana.app/slug`

- **Set by**: Frontend response transformer (`ResponseTransformers.ts:132`)
- **Read by**: Frontend for URL generation
- **Verdict**: **Remove (already deprecated).** Slugs are derived from the dashboard title. The DTO subresource already computes and returns the slug. The frontend should compute this client-side from the title.

#### 19-20. Snapshot Annotations (`dashboard-is-snapshot`, `dashboard-snapshot-original-url`)

- **Set by**: Frontend response transformer for snapshot dashboards
- **Read by**: Frontend scene serialization
- **Verdict**: **Remove (already deprecated).** Snapshots are a separate resource type. Whether something is a snapshot should be determined by the resource's `kind`/`apiVersion`, not an annotation. The original URL should be a field in the Snapshot spec.

#### 21. `grafana.app/dashboard-gnet-id`

- **Set by**: Frontend response transformer when importing from grafana.com
- **Read by**: Frontend for grafana.com linking
- **Verdict**: **Remove (already deprecated).** This is dashboard provenance data. Should be:
  - A field in `spec` (e.g., `spec.gnetId`) if it's semantically meaningful
  - Part of the manager/source annotations if imported via a tool
  - Or simply tracked in the import history

#### 22-23. Folder Title/URL Shims (`folderTitle`, `folderUrl`)

- **Set by**: Frontend v2 API client after fetching folder info (`v2.ts:63-64`)
- **Read by**: Frontend for breadcrumbs and navigation
- **Verdict**: **Remove (already deprecated).** These are explicitly marked as "NOT A REAL annotation" in the code. They are client-side shims that inject data from a separate folder API call into the annotation map for convenience. The frontend should:
  - Fetch folder info separately and store it in application state
  - Use the folder API/cache to resolve folder UID -> title/URL

#### 24. `grafana.app/embedded`

- **Set by**: Frontend `DashboardScenePageStateManager` (`DashboardScenePageStateManager.ts:965`)
- **Read by**: Frontend scene serialization for embedded dashboards
- **Verdict**: **Remove (already deprecated).** "Embedded" is a rendering context, not a property of the resource. Should be a scene/context flag passed through the component tree, not persisted on the resource.

#### 25. `grafana.app/reloadOnParamsChange`

- **Set by**: Proxy layer (experimental)
- **Read by**: Frontend dashboard reload behavior
- **Verdict**: **Remove.** Explicitly marked as experimental and "will be removed in short-term future". Should be a feature flag + proxy configuration, not a resource annotation.

---

### Category 4: Legacy Labels (Used as Both Labels and Annotations)

#### 26. `grafana.app/deprecatedInternalID` (label)

- **Set by**: Storage layer on CREATE (`prepare.go:128`), mutation hooks
- **Read by**: Legacy API endpoints that need numeric IDs, search, star service
- **Verdict**: **Remove.** Already deprecated and scheduled for removal in Grafana 13. Legacy API endpoints using numeric IDs should be migrated to use k8s resource names (UIDs).

#### 27-29. Origin Annotations (`originName`, `originPath`, `originHash`)

- **Set by**: Not actively set; only found in test data and SQL seed data
- **Read by**: Not actively read in current codebase
- **Verdict**: **Remove.** These are completely superseded by the manager/source property annotations (items 8-14). They exist only in historical test fixtures and can be cleaned up.

---

## Annotations by Generated Code (`grafana.com/` Prefix Mismatch)

The generated `dashboard_object_gen.go` files (via `grafana-app-sdk`) use a different prefix:

| Generated Key                 | Equivalent `grafana.app/` Key  |
| ----------------------------- | ------------------------------ |
| `grafana.com/createdBy`       | `grafana.app/createdBy`        |
| `grafana.com/updatedBy`       | `grafana.app/updatedBy`        |
| `grafana.com/updateTimestamp` | `grafana.app/updatedTimestamp` |

This is a **prefix mismatch** between the App SDK generated code (`grafana.com/`) and the runtime utils (`grafana.app/`). The runtime `GrafanaMetaAccessor` (which is what the storage layer uses) reads/writes `grafana.app/*`. The generated object methods are not currently used by the storage/prepare layer — `MetaAccessor()` wraps the raw object and uses its own annotation keys.

This mismatch should be resolved by aligning the generated code to use `grafana.app/` prefix, or by removing the generated annotation accessors in favor of `GrafanaMetaAccessor`.

---

## Recommended Actions (Priority Order)

### Immediate (No Breaking Changes)

1. **Remove `grafana.app/grant-permissions`** from the annotation flow → move to query parameter on CREATE requests
2. **Remove FE-only shims** (`slug`, `folderTitle`, `folderUrl`, `embedded`, `dashboard-is-snapshot`, `dashboard-snapshot-original-url`, `dashboard-gnet-id`) from the annotation type definitions → store these in frontend application state only
3. **Remove `grafana.app/reloadOnParamsChange`** → replace with feature flag behavior

### Short-Term

4. **Move `grafana.app/blob`** to `status` subresource or internal storage metadata
5. **Move `grafana.app/message`** to a request header or query parameter
6. **Move `grafana.app/updatedTimestamp` and `grafana.app/updatedBy`** to the `status` subresource
7. **Remove `grafana.app/saved-from-ui`** → include in `User-Agent` or commit message
8. **Clean up origin annotations** (`originName`, `originPath`, `originHash`) from test data

### Medium-Term

9. **Move `grafana.app/folder`** to a label for better query performance
10. **Remove `grafana.app/fullpath` and `grafana.app/fullpathUIDs`** once legacy storage modes are removed
11. **Resolve `grafana.com/` vs `grafana.app/` prefix mismatch** in generated code
12. **Remove `grafana.app/deprecatedInternalID`** as part of Grafana 13 cleanup

---

## What Should Remain as Annotations

After all removals, the dashboard resource should ideally have only these annotations:

| Annotation                       | Purpose                                  |
| -------------------------------- | ---------------------------------------- |
| `grafana.app/createdBy`          | Audit: who created this resource         |
| `grafana.app/managedBy`          | External tool management kind            |
| `grafana.app/managerId`          | External tool identity                   |
| `grafana.app/managerAllowsEdits` | Whether managed resource allows UI edits |
| `grafana.app/managerSuspended`   | Whether management is suspended          |
| `grafana.app/sourcePath`         | Provisioning source file path            |
| `grafana.app/sourceChecksum`     | Provisioning source content hash         |
| `grafana.app/sourceTimestamp`    | Provisioning source last modified time   |

Everything else either belongs in `spec`, `status`, labels, request parameters, or client-side state.
