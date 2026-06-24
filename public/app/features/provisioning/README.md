# Provisioning (frontend)

This package contains Grafana's repository (Git Sync) provisioning UI and the shared building
blocks for showing whether a resource is **managed** by an external system.

Use this guide when adding provisioning awareness to a new frontend resource type (folders,
dashboards, playlists, library panels, …). It does **not** cover enabling provisioning on the
backend — a resource can only be repository-provisioned once the backend supports it; see
`pkg/registry/apis/provisioning`.

## Concepts

Provisioning state lives in the resource's app-platform `metadata.annotations`:

| Annotation | Constant | Meaning |
|---|---|---|
| `grafana.app/managedBy` | `AnnoKeyManagerKind` | Which system owns the resource: the `ManagerKind`. |
| `grafana.app/managerId` | `AnnoKeyManagerIdentity` | Identity of the manager, such as the repository name. |
| `grafana.app/managerAllowsEdits` | `AnnoKeyManagerAllowsEdits` | Whether the manager permits UI edits. |
| `grafana.app/sourcePath` | `AnnoKeySourcePath` | Path of the source file within the managing repository. |

`ManagerKind` (`app/features/apiserver/types`) currently includes `repo`, `terraform`, `kubectl`,
`plugin`, `grafana`, and `classic-file-provisioning`. The annotation may also hold values not in the
enum, so treat "managed" as any manager value being present.

Two related states matter:

- **Managed**: the resource is owned by any external manager. It may be read-only.
- **Managed by a repository**: the resource is specifically managed by the repository provisioning
  feature (`managedBy === repo`). This is the kind with a first-class editing workflow in the UI and
  the kind that drives the "Provisioned" badge.

Repository provisioning UI is gated by `config.featureToggles.provisioning`. Which resource kinds
are provisionable comes from `RepositoryViewList.availableResources`, with entries shaped like
`{ group, kind, disabled? }`. The settings endpoint includes disabled kinds; use
`getAvailableResourceKinds` or `isResourceKindAvailable` from [`utils/resourceKinds.ts`](./utils/resourceKinds.ts)
when a UI must exclude disabled resources. Per-instance managed state still comes from annotations.

## Helpers

Use the generic helpers in [`utils/managedResource.ts`](./utils/managedResource.ts) instead of
reading annotations inline. They accept any resource that exposes `metadata.annotations`, so the same
code works for folders, dashboards, playlists, library panels, and future app-platform resources.

```ts
import {
  getManagerIdentity,
  getManagerKind,
  getSourcePath,
  isItemManagedByRepository,
  isManaged,
  isManagedByRepository,
  isManagedResourceReadOnly,
} from 'app/features/provisioning/utils/managedResource';

isManagedByRepository(resource); // managedBy === 'repo'
isManaged(resource); // any manager present, including unknown kinds
getManagerKind(resource); // ManagerKind | undefined for known kinds
getManagerIdentity(resource); // repository or manager identity, if any
getSourcePath(resource); // repository source path, if any
isManagedResourceReadOnly(resource); // managed, not repo, and edits not allowed
isItemManagedByRepository(item); // flattened list/search item with managedBy === repo
```

`isManagedResourceReadOnly` excludes repository-managed resources because they have their own edit
workflow, matching `DashboardScene`. Some resources treat repository-managed instances as read-only
too; in that case compose `isManaged` with the `managerAllowsEdits` check directly instead of reusing
this helper.

Some surfaces, such as search results and folder DTOs, expose the manager kind as a flattened
`managedBy` field instead of `metadata.annotations`. Use `isItemManagedByRepository` for that shape.

## Resource kind registry

[`utils/resourceKinds.ts`](./utils/resourceKinds.ts) is the frontend registry for provisionable
resource metadata. It contains one entry per UI-supported kind:

- `group`, `kind`, and plural `resource`.
- `itemType`, icon, detail route, and list route.
- `folderScoped`, whether the kind carries a folder annotation (mirrors the backend `folder` capability).

`getAvailableResourceKinds(availableResources)` gates that registry with backend settings and filters
out entries where `disabled` is true. Adding a new provisionable resource still needs a registry entry
and tests in `resourceKinds.test.ts`; the backend declaration alone is not enough for the resource to
appear correctly in the combined files/resources tree, stats, routes, and icons.

## Managed badge

Use the shared [`ManagedBadge`](./components/ManagedBadge.tsx) so styling stays consistent across
resource types. It is the same badge rendered on dashboard and folder pages, so new resources should
match it. Show it for any manager (not just repositories) by gating on `isManaged` and passing the
manager kind and identity:

```tsx
import { ManagedBadge } from 'app/features/provisioning/components/ManagedBadge';
import { getManagerIdentity, getManagerKind, isManaged } from 'app/features/provisioning/utils/managedResource';

{
  isManaged(resource) && <ManagedBadge managerKind={getManagerKind(resource)} name={getManagerIdentity(resource)} />;
}
```

`ManagedBadge` renders repository, terraform, kubectl, plugin, classic file provisioning, orphaned,
and generic provisioned states. Unknown manager kinds should still render as managed; do not hide the
badge just because `getManagerKind` returns `undefined`.

## Read-only badge

Use [`ReadOnlyBadge`](./components/ReadOnlyBadge.tsx) alongside the managed badge for managed resources
that do not allow UI edits. Pass `repoType` when repository context is available so local repositories
get local-file tooltip copy:

```tsx
import { ReadOnlyBadge } from 'app/features/provisioning/components/ReadOnlyBadge';
import { isManagedResourceReadOnly } from 'app/features/provisioning/utils/managedResource';

{
  isManagedResourceReadOnly(resource) && <ReadOnlyBadge repoType={repository?.type} />;
}
```

On folder and dashboard pages the read-only state can also reflect a read-only repository resolved
through [`useGetResourceRepositoryView`](./hooks/useGetResourceRepositoryView.ts).

Gate edit, delete, rename, move, and other mutating actions on the same read-only check so a read-only
managed resource cannot be changed from the UI:

```tsx
const isReadOnly = isManagedResourceReadOnly(resource);

<LinkButton href={editHref} disabled={isReadOnly}>
  Edit
</LinkButton>
<Button variant="destructive" disabled={isReadOnly} onClick={onDelete}>
  Delete
</Button>
```

`useGetResourceRepositoryView` returns repository context for forms and badges: `status` (`disabled`,
`loading`, `ready`, `error`, or `orphaned`), `repository`, `repoType`, `folder`, `isReadOnlyRepo`,
`isInstanceManaged`, `isMissingRepo`, and `orphanedRepoName`. Use these fields instead of re-querying
settings inline.

## Source link

[`SourceLink`](./components/SourceLink.tsx) renders a button that opens a repository-managed resource's
source file in its Git provider. It checks the provisioning feature toggle, resolves the repository
with `useGetResourceRepositoryView`, and only renders for providers that can produce a browsable file
URL. Give it the managing repository name and the resource's source path:

```tsx
import { SourceLink } from 'app/features/provisioning/components/SourceLink';
import { getManagerIdentity, getSourcePath } from 'app/features/provisioning/utils/managedResource';

<SourceLink repositoryName={getManagerIdentity(resource)} sourcePath={getSourcePath(resource)} />;
```

It renders nothing when there is no resolvable Git source (non-repository-managed resources, local or
generic Git provisioning, or missing `sourcePath`). Folder pages show it when the folder has a metadata
file.

## Save flow

Repository-managed resources with an individual save flow should save **through Git Sync** instead of
writing directly to the resource API. Use the shared
[`SaveProvisionedResourceDrawer`](./components/Shared/SaveProvisionedResourceDrawer.tsx) — it owns the
whole drawer (header + branch / path / comment fields + the replace-file mutation + request handling).
The managing repository and source path are resolved from the resource's annotations; the caller just
provides the resource, the file body, and the display/commit metadata:

```tsx
import { SaveProvisionedResourceDrawer } from 'app/features/provisioning/components/Shared/SaveProvisionedResourceDrawer';

<SaveProvisionedResourceDrawer
  resource={resource}
  resourceType="dashboard" // CommitResourceKind
  resourceName={resource.metadata.name}
  body={fileBody}
  drawerTitle={t('...', 'Save provisioned dashboard')}
  action="update" // CommitAction; defaults to 'update'
  onDismiss={onDismiss}
  onSuccess={onSuccess}
/>;
```

Commit messages are built generically in [`utils/commitMessage.ts`](./utils/commitMessage.ts): one
template per `CommitAction` (`create` / `update` / `delete` / `move` / `rename`) that interpolates the
resource kind and title, e.g. `Save {{resourceKind}}: {{title}}`.

To reuse the drawer for a **new** kind: add it to the `CommitResourceKind` union (`commitMessage.ts`)
and to the shared request handler ([`hooks/useProvisionedRequestHandler.ts`](./hooks/useProvisionedRequestHandler.ts)),
which keys off the same type. Resources that are only managed in bulk, or have no individual save flow,
can skip this and still use the shared managed badges, read-only gating, and source links.

## Adding awareness to a new resource

1. Confirm the resource is served from the app-platform API so its `metadata.annotations` carry the
   manager annotations. Most `*.grafana.app` resources do; legacy REST-only resources need an
   app-platform client first.
2. Confirm the backend declares the resource kind in provisioning config. Gate kind visibility on
   `availableResources` / `getAvailableResourceKinds`, respecting `disabled`.
3. Detect managed state with the helpers above. Never compare annotation strings inline.
4. Add the kind to [`utils/resourceKinds.ts`](./utils/resourceKinds.ts) (group, kind, plural resource,
   item type, icon, routes, `folderScoped`) and update `resourceKinds.test.ts`.
5. Show `ManagedBadge` in listing, detail, and edit views for any managed resource.
6. Show `ReadOnlyBadge` and gate mutating actions when `isManagedResourceReadOnly` is true, or when
   repository context says the source repository is read-only.
7. Use `SourceLink` when the resource has a repository identity and source path.
8. For resources with an individual save flow, route repository-managed saves through
   `SaveProvisionedResourceDrawer` (extend `CommitResourceKind` and the shared request handler).
9. Guard repository-specific UI with `config.featureToggles.provisioning`.
10. Test unmanaged, managed-by-repository, managed-by-other-manager, read-only, orphaned-repository,
    and missing-source-path cases. Start with [`utils/managedResource.test.ts`](./utils/managedResource.test.ts)
    for the helper contract.

## Reference

- [`app/features/apiserver/types.ts`](../apiserver/types.ts) — annotation constants and `ManagerKind`.
- [`utils/managedResource.ts`](./utils/managedResource.ts) — generic managed-resource helpers.
- [`utils/resourceKinds.ts`](./utils/resourceKinds.ts) — frontend metadata registry and `availableResources` gating.
- [`utils/repository.ts`](./utils/repository.ts) — read-only repository workflow checks and flattened item lookups.
- [`utils/commitMessage.ts`](./utils/commitMessage.ts) — commit-message templates (`CommitAction`, `CommitResourceKind`).
- [`components/ManagedBadge.tsx`](./components/ManagedBadge.tsx) — shared managed/provisioned badge.
- [`components/ReadOnlyBadge.tsx`](./components/ReadOnlyBadge.tsx) — shared read-only badge.
- [`components/SourceLink.tsx`](./components/SourceLink.tsx) — link to a resource's source file.
- [`components/Shared/SaveProvisionedResourceDrawer.tsx`](./components/Shared/SaveProvisionedResourceDrawer.tsx) — shared save-through-Git-Sync drawer.
- [`hooks/useGetResourceRepositoryView.ts`](./hooks/useGetResourceRepositoryView.ts) — resolve repository context for a resource or folder.
- [`utils/tooltip.ts`](./utils/tooltip.ts) — shared tooltip copy.
