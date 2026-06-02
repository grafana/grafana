# Spec: `folderless` Sync Target for Git Sync Provisioning

**Status:** Draft / proposal
**Area:** Grafana provisioning (`provisioning.grafana.app/v0alpha1`)
**Author:** Roberto Jimenez Sanchez
**Reviewers:** _TBD_

---

## 1. Summary

Add a new `spec.sync.target` value, **`folderless`**, to Git Sync provisioning. It
behaves like the existing `folder` target — multiple repositories allowed,
coexisting with unprovisioned and other-managed content — but does **not** create
a wrapper folder. Resources declared at the repository path root map to top-level
(folderless) resources; subdirectories map to top-level folders. Folder hierarchy
is preserved and round-trips cleanly.

This fills the gap between `folder` (every repo quarantined inside its own folder)
and `instance` (a single repo that owns the entire instance).

---

## 2. Naming decision

| Surface | Value |
|---|---|
| Enum / YAML / `gcx` (`spec.sync.target`) | `folderless` |
| UI wizard label | **"Sync to top level (no folder)"** (short form: "Top-level sync") |

Rationale: the defining trait of this target is the *absence of the wrapper
folder*, which is exactly what distinguishes it from `folder`. A mechanism-based
name (`folderless`) describes that directly and avoids the exclusivity
connotation that destination names like `root` carry (which blur into
`instance`). `flat` was rejected because it implies collapsing subfolders away —
a different, lossy behavior we are explicitly *not* building here.

> If a genuine "collapse all hierarchy to root" mode is wanted later, it should be
> a separate target (e.g. `flat`), not a variant of this one.

---

## 3. Semantics

Authoritative behavior rules. The hard parts of the implementation fall out of these.

1. **No container folder.** No repo-named folder is auto-created. Files at the
   repository path root become top-level resources.
2. **Hierarchy preserved.** A subdirectory in the repo becomes a top-level folder;
   nested subdirectories nest accordingly. A folder created in the UI under a
   `folderless` repo serializes back to a subdirectory in Git.
3. **Non-exclusive.** Multiple `folderless` repos may coexist with each other,
   with `folder` repos, and with unprovisioned resources.
4. **Per-resource ownership.** Because folder containment can no longer identify
   what a repo manages, ownership is tracked via manager annotations
   (`grafana.app/managedBy`, manager identity = repository name). Sync, deletion,
   and reconciliation MUST act only on resources whose manager is *this* repo.
5. **Collision rules.**
   - Two repos MUST NOT declare the same resource UID.
   - A `folderless` repo MUST NOT adopt an existing unprovisioned or
     other-managed resource except through an explicit **migrate**.
   - Policy on UID collision: **hard fail** (surface as a sync/validation error),
     not last-writer-wins.

---

## 4. Comparison to existing targets

| Dimension | `folder` | `instance` | `folderless` (this spec) |
|---|---|---|---|
| Wrapper folder created | Yes, one per repo | No | No |
| Repo subdirs → folders | Yes (under wrapper) | Yes (at top level) | Yes (at top level) |
| Hierarchy preserved / round-trips | Yes | Yes | Yes |
| Multiple repos | Yes | No (singleton) | Yes |
| Coexists w/ unprovisioned & other repos | Yes | No (owns all) | Yes |
| Ownership scope | Wrapper folder subtree | Entire instance | Per-resource (annotation) |
| Setup permission bar | Folder admin | Instance/org admin | Org/instance admin |

**vs `folder`:** same multiplicity and coexistence, but writes to the shared root
and owns resources individually by annotation rather than by folder containment.

**vs `instance`:** both place resources at the root with no wrapper, but
`instance` is exclusive and owns the whole tree, while `folderless` is
non-exclusive and owns only what it declares. This ownership-scoping is the core
engineering difference and the highest-risk code path.

---

## 5. File ↔ resource mapping

Repo path root = instance root (empty parent folder).

```
repo/                         instance:
  cpu.json            →         [top level] dashboard "cpu"
  alerts.json         →         [top level] dashboard/resource "alerts"
  team-x/                       [top level] folder "team-x"
    .folder.json      →           (folder metadata: uid, title)
    mem.json          →           dashboard "mem" inside folder "team-x"
    sub/                          folder "sub" inside "team-x"
      io.json         →             dashboard "io" inside "sub"
```

Round-trip rules:
- Top-level dashboard ⇄ JSON file at repo path root.
- Top-level folder ⇄ subdirectory at repo path root (with `.folder.json`).
- UI move from root → subfolder = file moved into a subdirectory (reparenting).
- UI move from subfolder → root = file moved to the repo path root.
- Deleting a folder in the UI = delete the corresponding subdirectory (subject to
  the same per-repo ownership guard).

---

## 6. Backend design

- **Types / API.** Add `folderless` to the `SyncTargetType` enum in the
  provisioning `v0alpha1` types; regenerate deepcopy, openapi, and CRD. _(Verify
  current type location; codebase moves fast.)_
- **Validation.** Update admission/validation to accept `folderless` and enforce
  the §3.5 collision rules.
- **Target abstraction.** Prefer a `folderlessTarget` implementation alongside
  `folderTarget` / `instanceTarget` (interface or strategy) over scattering
  `if target == folderless` checks. Most read/list paths can reuse folder logic
  with the instance root as the base.
- **Folder-tree resolution.** Add a root-based resolver whose base parent is the
  instance root and which does not synthesize a wrapper folder.
- **Sync reconciliation (core change).** Scope the "currently managed" set by a
  manager-annotation query filtered to this repo; diff against repo files; create/
  update/delete only resources this repo owns. This filter is the critical
  safety invariant — a wrong scope can delete other repos' or unprovisioned
  resources.

> Implementation note (verified against current code): ownership is already
> annotation-based — `ListManagedObjects` filters by `Kind=repo, Id=<repo-name>`,
> never by folder containment — and `resources.RootFolder()` already returns `""`
> for any non-`folder` target. So `folderless` largely falls out of existing code:
> the concrete changes are the enum value, the `Target != Folder` conditions that
> must also exclude `folderless` (e.g. `jobs/migrate/unifiedstorage.go`),
> validation, code regen, and tests. No new strategy abstraction is strictly
> required.

---

## 7. Frontend

- Add `folderless` as a selectable option in the setup wizard's
  "Choose what to synchronize" step, labeled **"Sync to top level (no folder)"**,
  with copy clarifying: syncs to the top level, no wrapper folder, coexists with
  other content, subfolders still supported.
- Repository settings/summary views: render `target: folderless`.
- Resource preview/tree UI: render a folderless root (no synthetic wrapper node);
  show top-level resources and any top-level folders the repo defines.
- Surface the new validation/collision errors inline (UID already managed
  elsewhere, etc.).

---

## 8. Jobs & file operations

| Job / op | Behavior for `folderless` |
|---|---|
| **Pull / Sync** | Uses the per-repo ownership-scoped differ (§6). |
| **Export** | Managed instance resources written to repo; top-level resources at path root, top-level folders as subdirectories. Decide: export only this repo's managed resources vs. a user-selected subtree. |
| **Migrate** | Adopt unprovisioned resources by stamping this repo's manager annotation and writing them at root; no folder move. Must apply the collision guard. Consider a dry-run/preview since it writes to the shared root. |
| **File create/update/delete** | Path ↔ resource mapping treats repo root as folderless parent. |
| **File move / rename** | Move between root and a subdirectory = reparent to/from top level. |

Full vs incremental sync and any `.keep`-style logic need explicit definition for
the no-wrapper-folder case (open question, §10).

---

## 9. Permissions

- Creating/deleting a `folderless` repo requires org/instance admin (same bar as
  `instance`), because it writes to the shared top level.
- Provisioned top-level resources receive permissions like any folderless
  resource (general/root scope). Do not invent a hidden permission folder.
- Editing a provisioned root resource requires the same permission as editing
  that resource normally.
- Guard against privilege escalation: a low-privilege user must not be able to use
  a `folderless` repo to create resources at root they otherwise could not.

---

## 10. Open questions & risks

- **Deletion safety (highest risk).** A bug in the ownership scope could wipe
  unprovisioned or other repos' root content. Treat the per-repo annotation filter
  as a hard invariant with dedicated tests.
- **Full vs incremental sync** behavior with no container folder; `.keep`-style
  handling.
- **Export scope:** all managed resources vs. user-selected subtree.
- **Migrate UX:** is a dry-run/preview required given it touches shared root?
- **UID collision policy** confirmed as hard-fail — verify this is consistent with
  how `folder`/`instance` surface similar errors.

---

## 11. Integration tests

Mirror the existing folder/instance provisioning suite (`pkg/tests/apis/provisioning`)
with `folderless` cases:

- Create a `folderless` repo; resources land at top level with no wrapper folder;
  subdirectories become top-level folders.
- **Two `folderless` repos coexisting** + unprovisioned content: each manages only
  its own resources; a sync in one never deletes the other's or the unprovisioned
  resources.
- Per-job round-trip: export → pull → migrate.
- File ops: create / update / delete / move, including reparenting between root and
  a subfolder, and folder create/delete.
- Negative/collision cases: duplicate UID across repos; attempted adoption of an
  unprovisioned resource without migrate.
- Permission enforcement cases, including the escalation guard.

---

## 12. Suggested sequencing

1. Types + validation.
2. Backend target abstraction + ownership-scoped sync reconciliation.
3. File operations (path ↔ resource mapping).
4. Jobs: pull, export, migrate.
5. Integration tests in parallel with each backend slice.
6. Frontend wizard + settings + preview.
7. Permissions hardening.
8. Documentation.
</content>
