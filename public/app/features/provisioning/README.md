# Provisioning SDK for app plugins

The `provisioning` namespace in `@grafana/runtime` lets an app plugin support Git Sync for its own
kinds. It has helpers that read the manager annotations, a registration call for the kinds the app
serves, and four UI components. `grafana/app-examples/example-gitsync-app` shows the full flow.

```ts
import { provisioning } from '@grafana/runtime';
```

The components follow the `FolderPicker` pattern: `@grafana/runtime` exports a shell, and Grafana
sets the implementation at startup (`provisioning.setComponents` in `app.ts`). Core pages and
plugins import the same component, and no `plugin.json` entry is needed.

## 1. Read the manager annotations

A resource that Git Sync (or Terraform, kubectl, a plugin) manages carries annotations on
`metadata.annotations`. The helpers read them from any k8s-style object.

| Helper                         | Returns                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `isManaged(resource)`          | `true` when any external system manages the resource.              |
| `getManagerKind(resource)`     | `repo` (Git Sync), `terraform`, `kubectl`, `plugin`, or none.       |
| `getManagerIdentity(resource)` | The repository name for Git Sync.                                  |
| `getSourcePath(resource)`      | The file path in the repository.                                   |
| `isManagedFolderError(error)`  | `true` when a write failed because the folder is Git Sync managed. |

## 2. Register the kinds the app serves

Call this once in `module.ts`. The Git Sync admin pages then show the kind with a name, an icon and
a link, instead of the raw plural resource name.

```ts
provisioning.registerResourceKinds([
  { group: 'myapp.ext.grafana.app', kind: 'Note', label: 'Note', icon: 'file-alt', listRoute: '/a/myapp' },
  { group: 'myapp.ext.grafana.app', kind: 'Tag', folderScoped: false, listRoute: '/a/myapp' },
]);
```

Only `group` and `kind` are required. Defaults: `resource` is the lowercase kind plus `s`, `label`
is the kind, `icon` is `file-alt`, and `folderScoped` is `true`. Core kinds (folders, dashboards,
playlists, library panels) are in the same registry and win on a conflict.

## 3. Show the managed badge

The badge is the one that dashboards and playlists show. It renders nothing for an unmanaged
resource, so render it for every row.

```tsx
<provisioning.ManagedBadge resource={item} />
```

## 4. Save in one drawer

`SaveResourceDrawer` is one drawer for the resource fields and the commit fields, like the dashboard
save drawer. Render the resource fields as `children`, return the spec from `getSpec`, and store the
resource in Grafana from `onSave`. The drawer decides where the save goes:

- `folderName` set and the folder is Git Sync managed: the commit fields show, and Save commits to
  that repository, in the folder's directory.
- Folderless kind with `onSave`: a repository picker shows. A pick commits to that repository; no pick
  calls `onSave`.
- `update` or `delete` of a managed resource: the resource annotations name the repository.
- Otherwise: Save calls `onSave`.

```tsx
<provisioning.SaveResourceDrawer
  action={resource ? 'update' : 'create'}
  title={name}
  folderName={folderUid}
  resource={resource ?? { apiVersion: 'myapp.ext.grafana.app/v1alpha1', kind: 'Note' }}
  getSpec={() => ({ name })}
  onSave={() => (resource ? update(resource, { name }) : create({ name }, folderUid))}
  onDismiss={close}
  onWriteSuccess={() => { close(); refresh(); }}
  onBranchSuccess={(commit) => { close(); setCommit(commit); }}
>
  <Field label="Name"><Input value={name} onChange={(e) => setName(e.currentTarget.value)} /></Field>
  <Field label="Folder"><FolderPicker value={folderUid} onChange={setFolderUid} /></Field>
</provisioning.SaveResourceDrawer>
```

Results:

- `onSave()`: no repository was involved. The plugin stored the resource.
- `onWriteSuccess(resource)`: the commit went to the configured branch and Grafana stored the resource.
- `onBranchSuccess(commit)`: the commit went to another branch. The resource is not in Grafana until
  the branch merges and the repository syncs. Pass `commit` to the pull request banner (step 5).
- `onDismiss()`: the user closed the drawer.

A plugin with its own form can still use the drawer as a second step: save through the API, and
open the drawer with `folderName` when `isManagedFolderError` matches, or with `RepositorySelect`
in its form for a folderless kind.

## 5. Show the pull request banner

After `onBranchSuccess`, keep the commit in state and render the banner at the top of the page. It is
the banner that dashboards show, with the branch names and an "Open pull request" link.

```tsx
{commit && <provisioning.PullRequestBanner {...commit} action="create" />}
```

## Backend requirements

Grafana must serve the app's kinds through the router middleware (`grafana.useRouterMiddleware`),
and the kinds must be listed in `[provisioning] resources` in the Grafana config, for example
`myapp.ext.grafana.app/Note:folder,myapp.ext.grafana.app/Tag`.

## Implementation

The shells are in `packages/grafana-runtime/src/utils/provisioning.tsx`. The implementations are in
`components/Shared/`: `SaveResourceDrawer`, `ManagedBadgeForResource`, `PullRequestBanner` and
`RepositorySelectForKind`, loaded lazily through `runtimeComponents.tsx`. They wrap
`SaveProvisionedResourceDrawer`, `ManagedBadge`, `PreviewBannerViewPR` and `RepositorySelect`, the
components that the playlist pages use.
