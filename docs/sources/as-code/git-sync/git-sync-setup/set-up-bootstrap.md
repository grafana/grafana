---
description: Instructions for bootstrapping the provisioning configuration from a directory on disk, so a Grafana instance provisions its own repositories and connections at startup.
keywords:
  - set up
  - git sync
  - bootstrap
  - as code
  - provisioning
  - file provisioning
  - configuration
labels:
  products:
    - enterprise
    - oss
title: Bootstrap provisioning configuration from a directory
weight: 220
canonical: https://grafana.com/docs/grafana/latest/as-code/git-sync/git-sync-setup/set-up-bootstrap/
---

# Bootstrap provisioning configuration from a directory

Starting in Grafana 13.4.0, you can point Grafana at a directory on disk that declares the instance's own provisioning configuration. Grafana registers a repository over that directory at startup and syncs it, so the repositories and connections the directory declares exist before anyone signs in. This works for [Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/) repositories and for [file provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/provision-resources/) repositories alike.

Use this when the instance has to come up already configured and you can't make an API call after it starts, for example when you run Grafana on ephemeral storage, in a container image, or behind an immutable deployment pipeline. The configuration is a file you keep in version control alongside the rest of your deployment, instead of a one-off setup step.

{{< admonition type="note" >}}

This feature is available in Grafana open source and Enterprise editions. It's **not available in Grafana Cloud**, where you don't control the Grafana configuration file.

{{< /admonition >}}

Before you begin, ensure you have the following:

- Access to the Grafana configuration file, `custom.ini` or `grafana.ini`, on the Grafana server.
- A directory on the Grafana server's file system that Grafana can read and write, mounted before Grafana starts.
- The resource manifests you want the instance to start with. Refer to [Set up Git Sync as code](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/git-sync-setup/set-up-code/) for the `Repository` and `Connection` resource formats.

## How it works

When `[provisioning] bootstrap_path` is set, Grafana creates a repository named `bootstrap` on every start:

- Its type is `local` and its path is the directory you configured.
- It uses [folderless sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/key-concepts/#sync-targets), because the directory holds instance configuration rather than a folder of dashboards.
- Grafana owns its configuration, so you can't edit it in the UI. To change it, change `bootstrap_path` and restart.

From there it's an ordinary repository. Every file in the directory is synced, including `Repository` and `Connection` manifests, so the bootstrap repository provisions the rest of your setup. Each repository it declares then syncs its own content, which is where the instance's dashboards and folders usually come from.

Grafana reconciles the repository on each start, so a changed `bootstrap_path` takes effect on restart and doesn't leave a second repository behind.

## Configure the bootstrap directory

Set `bootstrap_path` in the `[provisioning]` section of your Grafana configuration file:

```ini
[provisioning]
bootstrap_path = /etc/grafana/provisioning/bootstrap
```

The path can be absolute, or relative to the Grafana home directory.

Grafana refuses to start, naming the setting, if the value isn't a path a local repository could read:

- No traversal. A value containing `..`, or `.` on its own, is rejected.
- No hidden components. A path segment that starts with `.`, such as `/etc/.grafana/bootstrap`, is rejected.
- Not the filesystem root. `/` is rejected, because it would permit every local repository to read the whole host filesystem.

Grafana also refuses to start if the setting conflicts with the rest of the `[provisioning]` section:

- `repository_types`, when set, must include `local`. Grafana doesn't enable the type for you, because that would widen what the whole instance accepts.
- `allowed_targets` must include `folderless`, which is the target the bootstrap repository uses. The default, `folder|folderless`, already does.

You don't need to add the bootstrap path to `permitted_provisioning_paths`. Grafana permits it because it registers the repository itself, which is why the value is checked this strictly: the permission is granted to every local repository, before any repository exists. Any _other_ local path, including one a repository declared in the directory reads, still needs an explicit entry. Refer to [Configure permitted paths](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/provision-resources/file-path-setup/#configure-permitted-paths) for details.

While `bootstrap_path` is set, the `instance` sync target isn't available to any repository. A repository with the `instance` target can only exist in an instance that has no other repository, and the bootstrap repository is one.

## Declare your provisioning configuration

Put one manifest per file in the directory, in YAML or JSON. The following layout declares a GitHub App connection, a repository that uses it, and a dashboard that's provisioned directly from the bootstrap directory:

```text
/etc/grafana/provisioning/bootstrap
├── connection.yaml
├── repository.yaml
└── welcome-dashboard.json
```

Dashboards and folders in the directory are provisioned too. Because the bootstrap repository syncs folderless, `welcome-dashboard.json` becomes a top-level dashboard, and a subdirectory becomes a top-level folder.

`connection.yaml` declares the GitHub App credentials, shared by every repository that references it:

```yaml
apiVersion: provisioning.grafana.app/v0alpha1
kind: Connection
metadata:
  name: github-app
spec:
  title: GitHub App
  type: github
  github:
    appID: '<GITHUB_APP_ID>'
    installationID: '<GITHUB_INSTALLATION_ID>'
secure:
  privateKey:
    create: '<BASE64_ENCODED_PRIVATE_KEY>'
```

`repository.yaml` declares the repository that syncs your dashboards:

```yaml
apiVersion: provisioning.grafana.app/v0alpha1
kind: Repository
metadata:
  name: dashboards
spec:
  title: Dashboards
  type: github
  github:
    url: '<GIT_REPO_URL>'
    branch: main
    path: dashboards/
  connection:
    name: github-app
  workflows:
    - write
  sync:
    enabled: true
    intervalSeconds: 60
    target: folder
```

Replace the placeholders with your values:

- _`<GITHUB_APP_ID>`_: The ID of your GitHub App.
- _`<GITHUB_INSTALLATION_ID>`_: The installation ID of your GitHub App.
- _`<BASE64_ENCODED_PRIVATE_KEY>`_: The GitHub App private key, base64 encoded.
- _`<GIT_REPO_URL>`_: The URL of the Git repository to sync.

For the full set of fields on both resources, refer to [Configuration parameters](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/git-sync-setup/set-up-code/#configuration-parameters).

### Store credentials

Set a credential under `secure`, with the plaintext value in a `create` field, as in the examples above. Grafana encrypts it when it provisions the resource and keeps only a reference to the secret, so the value is never stored in the Grafana database and never appears in the API.

The file itself still holds the plaintext, so treat the bootstrap directory as a secret: mount it from a Kubernetes Secret or an equivalent, and keep it out of the repository that holds your dashboards.

### Declare a local repository

The bootstrap directory can also declare `local` repositories, so a single setting brings up your [file provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/provision-resources/) setup too:

```yaml
apiVersion: provisioning.grafana.app/v0alpha1
kind: Repository
metadata:
  name: team-dashboards
spec:
  title: Team dashboards
  type: local
  local:
    path: '<LOCAL_PATH>'
  workflows:
    - write
  sync:
    enabled: true
    intervalSeconds: 60
    target: folder
```

Replace _`<LOCAL_PATH>`_ with the directory that holds the dashboards. It must read a directory _outside_ the bootstrap path, and that directory must be listed in `permitted_provisioning_paths`. Two repositories can't sync the same files: a directory inside the bootstrap path is already synced by the bootstrap repository, and both would claim the resources it holds.

## Change provisioned resources in Grafana

The bootstrap repository is configured to write, so the resources it provisions stay editable and Grafana commits each edit back to the file it came from. Mount the directory read-write if you want that. Credential references survive the rewrite, so editing a repository doesn't invalidate its token.

The bootstrap repository's own configuration is the exception. It comes from `bootstrap_path`, so the UI shows it as read only and its settings form is closed. Editing it would have no effect: the next start would reconcile it back to what the configuration file says.

Removing a manifest from the directory deletes the resource it declared, like any other file a repository syncs.

{{< admonition type="caution" >}}

Removing a `Repository` manifest deletes that repository, and a repository is deleted with the finalizers it carries. A manifest that doesn't set `metadata.finalizers` gets `remove-orphan-resources`, so deleting it also deletes every dashboard and folder it had provisioned. Set `metadata.finalizers` to `release-orphan-resources`, `remove-pending-jobs`, and `cleanup` to keep those resources in Grafana as unmanaged instead.

{{< /admonition >}}

## Stop using the bootstrap directory

Clear `bootstrap_path` and restart Grafana. On the next start, Grafana deletes the bootstrap repository, which leaves the instance as the configuration describes it: nothing names the directory anymore, so nothing it provisioned has a source.

{{< admonition type="caution" >}}

Clearing `bootstrap_path` deletes everything the bootstrap repository provisioned. That includes the dashboards and folders in the directory, and the repositories and connections it declared — which take their own provisioned resources with them.

To keep the resources, export them first, or give each `Repository` manifest the `release-orphan-resources` finalizer before you clear the setting.

{{< /admonition >}}

Change the setting rather than the repository. Grafana doesn't offer **Delete** on the **Bootstrap** repository, because its configuration comes from a file; deleting it through the API does the same cleanup, but while `bootstrap_path` is still set the next start recreates it.

## Limitations

The bootstrap directory has the following limitations:

- Manifests are provisioned into the default organization only. A manifest that names another namespace is rejected.
- Values aren't expanded from the environment or from other files. A credential has to be in the manifest, as a `secure` value.
- The repository is registered at startup. If you delete it while Grafana runs, it isn't recreated until the next restart.
- It counts towards `max_repositories`, which defaults to `10`.

## Next steps

- [Set up Git Sync as code](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/git-sync-setup/set-up-code/) for the full `Repository` and `Connection` resource reference.
- [Set up file provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/provision-resources/file-path-setup/) to sync dashboards from a local directory without Git.
- [Work with provisioned repositories](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/use-git-sync/) once the instance is up.
