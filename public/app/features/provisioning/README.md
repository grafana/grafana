# Provisioning (frontend)

This package contains the frontend for Grafana's repository (git) provisioning feature and the
shared building blocks for showing whether a resource is **managed** by an external system.

This document is an initial guideline for adding provisioning awareness to a new resource type in
the frontend (e.g. dashboards, folders, playlists, ...). It does **not** cover enabling provisioning
for a resource on the backend — a resource can only be repository-provisioned once the backend
supports it (see `pkg/registry/apis/provisioning`).

## Concepts

Provisioning state lives in the resource's Kubernetes-style `metadata.annotations`:

| Annotation                       | Constant                    | Meaning                                             |
| -------------------------------- | --------------------------- | --------------------------------------------------- |
| `grafana.app/managedBy`          | `AnnoKeyManagerKind`        | Which system owns the resource (the `ManagerKind`). |
| `grafana.app/managerId`          | `AnnoKeyManagerIdentity`    | Identity of the manager (e.g. the repository name). |
| `grafana.app/managerAllowsEdits` | `AnnoKeyManagerAllowsEdits` | Whether the manager permits UI edits.               |

`ManagerKind` (`app/features/apiserver/types`) can be `repo`, `terraform`, `kubectl` or `plugin`.
The annotation may also hold values not in the enum (e.g. classic file provisioning), so treat
"managed" as _any_ value being present.

Two distinct ideas matter:

- **Managed** — the resource is owned by _any_ external manager. It may be read-only.
- **Managed by a repository** — specifically managed by the repository (git) provisioning feature
  (`managedBy === repo`). This is the only kind with a first-class editing workflow in the UI and
  the only one that drives the "Provisioned" badge.

## Helpers

Use the generic helpers in [`utils/managedResource.ts`](./utils/managedResource.ts) instead of
reading annotations inline. They accept **any** resource that exposes `metadata.annotations`, so the
same code works for folders, dashboards, playlists, etc.

```ts
import {
  getManagerKind,
  getManagerIdentity,
  isManaged,
  isManagedByRepository,
  isManagedResourceReadOnly,
} from 'app/features/provisioning/utils/managedResource';

isManagedByRepository(playlist); // managedBy === 'repo'
isManaged(playlist); // any manager present (incl. unknown kinds)
getManagerKind(playlist); // ManagerKind | undefined (known kinds only)
getManagerIdentity(playlist); // repository name, if any
isManagedResourceReadOnly(dashboard); // managed, not repo, and edits not allowed
```

> Note on read-only semantics: `isManagedResourceReadOnly` excludes repository-managed resources
> because they have their own edit workflow (matches `DashboardScene`). Some resources (e.g.
> correlations) treat repository-managed as read-only too — in that case compose `isManaged` with the
> `managerAllowsEdits` check directly rather than reusing this helper.

## Managed badge

Use the shared [`ManagedBadge`](./components/ManagedBadge.tsx) so the styling stays consistent. It is
the same badge rendered on dashboard pages (`ManagedDashboardNavBarBadge`) and folder pages
(`FolderRepo`), so playlists and any new resource match them. Show it for **any** manager (not just
repository) by gating on `isManaged` and passing the kind:

```tsx
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';
import { getManagerIdentity, getManagerKind, isManaged } from 'app/features/provisioning/utils/managedResource';

{
  isManaged(resource) && <ManagedBadge managerKind={getManagerKind(resource)} name={getManagerIdentity(resource)} />;
}
```

`ManagedBadge` renders the repository, terraform, kubectl and plugin variants, the orphaned state
(`isOrphaned`), and a generic "Provisioned" fallback when `managerKind` is omitted/unknown.

## Read-only badge

[`ReadOnlyBadge`](./components/ReadOnlyBadge.tsx) is shown alongside the managed badge for managed
resources that don't allow UI edits. Gate it on `isManagedResourceReadOnly`:

```tsx
import { ReadOnlyBadge } from 'app/features/provisioning/components/ReadOnlyBadge';
import { isManagedResourceReadOnly } from 'app/features/provisioning/utils/managedResource';

{
  isManagedResourceReadOnly(resource) && <ReadOnlyBadge />;
}
```

Pass `repoType` to switch the tooltip copy between git and local file provisioning. On folder and
dashboard pages the read-only state also reflects a read-only repository (`isReadOnlyRepo`) resolved
via [`useGetResourceRepositoryView`](./hooks/useGetResourceRepositoryView.ts).

Gate edit/delete actions on the same check so a read-only resource cannot be mutated from the UI —
playlists disable their **Edit** and **Delete** buttons, and the folder page disables inline title
editing plus the **Move**/**Delete** folder actions, when `isManagedResourceReadOnly` is true:

```tsx
const isReadOnly = isManagedResourceReadOnly(resource);

<LinkButton href={editHref} disabled={isReadOnly}>Edit</LinkButton>
<Button variant="destructive" disabled={isReadOnly} onClick={onDelete}>Delete</Button>
```

## Linking to the source file

[`SourceLink`](./components/SourceLink.tsx) renders a button — styled like the external links on
dashboards — that opens a repository-managed resource's source file in its git provider. Give it the
managing repository name and the resource's source path; it renders nothing when there is no
resolvable git source (not repository-managed, local/generic-git provisioning, or no source path):

```tsx
import { SourceLink } from 'app/features/provisioning/components/SourceLink';
import { getManagerIdentity, getSourcePath } from 'app/features/provisioning/utils/managedResource';

<SourceLink repositoryName={getManagerIdentity(resource)} sourcePath={getSourcePath(resource)} />;
```

On the folder page it is shown when the folder has a metadata file (its `sourcePath`).

## Adding provisioning awareness to a new resource — checklist

1. **Confirm the resource is served from the app platform API** so its `metadata.annotations` carry
   the manager annotations (most `*.grafana.app` resources do).
2. **Detect state** with the helpers above — never compare annotation strings inline.
3. **Show the badge** in listing and edit views with `ManagedBadge`.
4. **Gate edits** for managed resources that are read-only (disable the form / show a banner). Repo-
   managed resources should route through the provisioning edit flow; for richer repository context
   (read-only repo, orphaned repo, source link) use
   [`useGetResourceRepositoryView`](./hooks/useGetResourceRepositoryView.ts).
5. **Respect the feature toggle** — repository provisioning UI is behind
   `config.featureToggles.provisioning`. Guard repository-specific UI with it.
6. **Test** the managed/provisioned/unmanaged cases. See
   [`utils/managedResource.test.ts`](./utils/managedResource.test.ts) for the helper contract.

## Reference

- `app/features/apiserver/types.ts` — annotation constants and `ManagerKind`.
- `utils/managedResource.ts` — generic managed/provisioned helpers.
- `components/ManagedBadge.tsx` — shared managed/provisioned badge.
- `components/ReadOnlyBadge.tsx` — shared read-only badge.
- `components/SourceLink.tsx` — link to a resource's source file in its repository.
- `hooks/useGetResourceRepositoryView.ts` — resolve the repository backing a resource/folder.
- `utils/tooltip.ts` — shared tooltip copy for managed/read-only resources.
