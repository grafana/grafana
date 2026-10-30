---
description: Instructions for setting up Git Sync as code, so you can provision Git repositories for use with Grafana.
keywords:
  - set up
  - git integration
  - git sync
  - github
  - github enterprise
  - as code
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Set up Git Sync as code
weight: 200
canonical: https://grafana.com/docs/grafana/latest/as-code/git-sync/git-sync-setup/set-up-code
aliases:
  - ../../observability-as-code/git-sync/git-sync-setup/set-up-code/
  - ../../observability-as-code/provision-resources/git-sync-setup/
  - ../../observability-as-code/git-sync/provision-resources/git-sync-setup/
  - ../../../observability-as-code/provision-resources/git-sync-setup/
  - ../provision-resources/git-sync-setup/
---

# Set up Git Sync as code

You can also configure Git Sync using `gcx`, the Grafana CLI. Since Git Sync configuration is managed as code using Custom Resource Definitions (CRDs), you can create your required resources in YAML files and push them to Grafana using `gcx`. This approach enables automated, GitOps-style workflows for managing Git Sync configuration instead of using the Grafana UI.

For more information, refer to the following documents:

- [Repository resource](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/key-concepts#git-sync-repository-resource) and [Connection resource](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/key-concepts#git-sync-repository-resource) overview
- [Dashboard CRD Format](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/add-resources/dashboards-migrate)
- [Grafana CLI documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/)

To provision resources from a local file system as code instead of a Git repository, refer to [Set up file provisioning as code](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/provision-resources/file-path-setup#set-up-file-provisioning-as-code).

## Set up Git Sync as code with the Grafana CLI

To set up Git Sync as code with `gcx`, follow these steps:

1. Read [Before you begin](#before-you-begin).
1. [Create the connection resource](#create-the-connection-resource)
1. [Create the repository resource](#create-the-repository-resource)
1. [Push the resources to Grafana](#push-the-resources-to-grafana)
1. [Manage repository resources](#manage-repository-resources)
1. [Verify setup](#verify-setup)

## Before you begin

Understand the following:

- Git Sync [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/usage-limits).
- The [required resources (connection and repository)](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/key-concepts) to use Git Sync.

## Create the connection resource

A connection is the authentication setup between Grafana and an external Git provider, required when you're not using a Personal Access Token or a static token to authenticate.

### Create a GitHub App connection resource

If you're connecting Git Sync with GitHub App, create a `connection.yaml` file defining your Git Sync connection configuration:

```yaml
apiVersion: provisioning.grafana.app/v0alpha1
kind: Connection
metadata:
  name: '<GITHUB_CONNECTION_NAME>'
  namespace: default
spec:
  title: '<REPOSITORY_TITLE>'
  type: github
  url: https://github.com
  github:
    appID: '<GITHUB_APP_ID>'
    installationID: '<GITHUB_INSTALL_ID>'
secure:
  privateKey:
    create: '<GITHUB_PRIVATE_KEY>'
```

If your GitHub App is installed on GitHub Enterprise Server, set the type to `githubEnterprise` and use the `githubEnterprise` block instead:

```yaml
apiVersion: provisioning.grafana.app/v0alpha1
kind: Connection
metadata:
  name: '<GITHUB_CONNECTION_NAME>'
  namespace: default
spec:
  title: '<REPOSITORY_TITLE>'
  type: githubEnterprise
  githubEnterprise:
    appID: '<GITHUB_APP_ID>'
    installationID: '<GITHUB_INSTALL_ID>'
    serverUrl: '<GITHUB_ENTERPRISE_SERVER_URL>'
secure:
  privateKey:
    create: '<GITHUB_PRIVATE_KEY>'
```

Replace the placeholders with your values:

- _`<GITHUB_CONNECTION_NAME>`_: The name of your GitHub connection
- _`<REPOSITORY_TITLE>`_: Human-readable name displayed in Grafana UI
- _`<GITHUB_APP_ID>`_: GitHub App unique identifier
- _`<GITHUB_INSTALL_ID>`_: GitHub App installation id
- _`<GITHUB_PRIVATE_KEY>`_: GitHub App private key, base64-encoded
- _`<GITHUB_ENTERPRISE_SERVER_URL>`_: The URL of your GitHub Enterprise Server instance, for example `https://ghes.example.com`

### Create an OAuth App connection resource

If you're connecting Git Sync with an [OAuth App](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/git-sync-setup/set-up-before/#create-an-oauth-app), create a `connection.yaml` file with the client ID and secret of the app, and the fields for your provider:

```yaml
apiVersion: provisioning.grafana.app/v0alpha1
kind: Connection
metadata:
  name: '<OAUTH_CONNECTION_NAME>'
  namespace: default
spec:
  title: '<CONNECTION_TITLE>'
  type: '<CONNECTION_TYPE>' # githubOAuth, githubEnterpriseOAuth, gitlabOAuth, bitbucketOAuth, or gitOAuth
  oauth:
    clientID: '<CLIENT_ID>'
  # GitHub Enterprise only:
  githubEnterpriseOAuth:
    serverUrl: '<GITHUB_ENTERPRISE_SERVER_URL>'
  # Bitbucket only:
  bitbucket:
    workspace: '<BITBUCKET_WORKSPACE>'
  # Pure Git only:
  gitOAuth:
    authURL: '<AUTHORIZATION_URL>'
    tokenURL: '<TOKEN_URL>'
    scopes:
      - '<SCOPE>'
secure:
  clientSecret:
    create: '<CLIENT_SECRET>'
```

Replace the placeholders with your values:

- _`<OAUTH_CONNECTION_NAME>`_: The name of your OAuth App connection
- _`<CONNECTION_TITLE>`_: Human-readable name displayed in Grafana UI
- _`<CONNECTION_TYPE>`_: The OAuth connection type for your provider
- _`<CLIENT_ID>`_: The client ID of the OAuth App
- _`<CLIENT_SECRET>`_: The client secret of the OAuth App
- _`<GITHUB_ENTERPRISE_SERVER_URL>`_: The URL of your GitHub Enterprise instance
- _`<BITBUCKET_WORKSPACE>`_: The workspace that the OAuth consumer belongs to
- _`<AUTHORIZATION_URL>`_, _`<TOKEN_URL>`_, _`<SCOPE>`_: The OAuth endpoints of your Git provider, and the scopes that grant read and write access to your repositories

An OAuth App connection needs a user to approve access in the browser. After you push the connection, it shows as **Disconnected** until you authorize it:

1. Select **Administration > General > Provisioning** and go to the **Connections** tab.
1. Select the connection and click **Reauthorize**.
1. Approve the access in the provider tab that opens.

## Create the repository resource

A repository resource is a Grafana configuration object that defines the connection between a group of repositories and your Grafana instance via Git Sync. Depending on your Git provider and authentication method, add your Personal Access Token information or the connection name.

Create a `repository.yaml` file defining your Git Sync configuration:

```yaml
apiVersion: provisioning.grafana.app/v0alpha1
kind: Repository
metadata:
  name: '<REPOSITORY_NAME>'
spec:
  sync:
    enabled: true
    intervalSeconds: 60
    target: folder
  workflows:
    - write
    - branch
  title: '<REPOSITORY_TITLE>'

# Git Sync for GitHub:
spec:
  type: github
  github:
    url: '<GIT_REPO_URL>'
    branch: '<BRANCH>'
    path: grafana/
  # GitHub App or OAuth App connection only:
  connection:
    name: '<GITHUB_CONNECTION_NAME>'
# GitHub Personal Access Token only:
secure:
  token: { create: 'GIT_PAT' }

# Git Sync for GitHub Enterprise:
spec:
  type: githubEnterprise
  githubEnterprise:
    url: '<GIT_REPO_URL>'
    branch: '<BRANCH>'
    path: grafana/
  # GitHub Enterprise App connection only:
  connection:
    name: '<GITHUB_ENTERPRISE_CONNECTION_NAME>'
# GitHub Personal Access Token only:
secure:
  token: { create: 'GIT_PAT' }

# GitLab Personal Access Token only:
spec:
  type: gitlab
  gitlab:
    url: '<GIT_REPO_URL>'
    branch: '<BRANCH>'
secure:
  token: { create: 'GIT_PAT' }

# Bitbucket Personal Access Token only:
spec:
  type: bitbucket
  bitbucket:
    url: '<GIT_REPO_URL>'
    branch: '<BRANCH>'
    tokenUser: tokenuser
secure:
  token: { create: 'GIT_PAT' }

# Pure Git only:
spec:
  type: git
  git:
    url: '<GIT_REPO_URL>'
    branch: '<BRANCH>'
    path: 'grafana/'
    tokenUser: tokenuser
secure:
  token: { create: 'GIT_PAT' }
```

To use an OAuth App connection, set `spec.connection.name` instead of `secure.token`. The repository type must match the connection type: `githubOAuth` for `github`, `githubEnterpriseOAuth` for `githubEnterprise`, `gitlabOAuth` for `gitlab`, `bitbucketOAuth` for `bitbucket`, and `gitOAuth` for `git`.

Replace the placeholders with your values:

- _`<REPOSITORY_NAME>`_: Unique identifier for this repository resource
- _`<REPOSITORY_TITLE>`_: Human-readable name displayed in Grafana UI
- _`<GIT_REPO_URL>`_: GitHub repository URL
- _`<BRANCH>`_: Branch to sync
- _`<GITHUB_CONNECTION_NAME>`_: The name of your GitHub connection
- _`<GITHUB_ENTERPRISE_CONNECTION_NAME>`_: The name of your GitHub Enterprise connection
- _`<GIT_PAT>`_: Git provider Personal Access Token

{{< admonition type="note" >}}

Git Sync supports two sync targets: `target: folder` (the default) creates a folder named after the repository and places synced resources inside it, while `target: folderless` places synced resources at the top level without creating a wrapper folder. Refer to [Sync targets](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/key-concepts/#sync-targets) for details.

{{< /admonition >}}

## Configuration parameters

The following configuration parameters are available for the connection and repository resources.

Values under `secure` are stored encrypted and can't be read back after you create them.

### Connection parameters

| Field                                  | Description                                                                                                                                                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metadata.name`                        | Unique identifier for this connection resource. Repositories reference the connection by this name                                                                                                                                              |
| `spec.title`                           | Human-readable name displayed in Grafana UI                                                                                                                                                                                                     |
| `spec.description`                     | Description of the connection                                                                                                                                                                                                                   |
| `spec.type`                            | Connection type: `github`, `githubEnterprise`, `githubOAuth`, `githubEnterpriseOAuth`, `gitlabOAuth`, `bitbucketOAuth`, or `gitOAuth`                                                                                                           |
| `spec.url`                             | URL of the Git provider, for example `https://github.com`                                                                                                                                                                                       |
| `spec.github.appID`                    | GitHub App ID. Only for the `github` type                                                                                                                                                                                                       |
| `spec.github.installationID`           | GitHub App installation ID. Only for the `github` type                                                                                                                                                                                          |
| `spec.githubEnterprise.appID`          | GitHub App ID. Only for the `githubEnterprise` type                                                                                                                                                                                             |
| `spec.githubEnterprise.installationID` | GitHub App installation ID. Only for the `githubEnterprise` type                                                                                                                                                                                |
| `spec.githubEnterprise.serverUrl`      | URL of your GitHub Enterprise Server instance, for example `https://ghes.example.com`. Only for the `githubEnterprise` type                                                                                                                     |
| `spec.oauth.clientID`                  | Client ID of the OAuth App. Required for all OAuth connection types                                                                                                                                                                             |
| `spec.githubEnterpriseOAuth.serverUrl` | URL of your GitHub Enterprise Server instance. Only for the `githubEnterpriseOAuth` type                                                                                                                                                        |
| `spec.bitbucket.workspace`             | Workspace that the OAuth consumer belongs to. Only for the `bitbucketOAuth` type                                                                                                                                                                |
| `spec.gitOAuth.authURL`                | OAuth authorization endpoint of your Git provider, for example `https://gitlab.example.com/oauth/authorize`. Only for the `gitOAuth` type                                                                                                       |
| `spec.gitOAuth.tokenURL`               | OAuth token endpoint of your Git provider, for example `https://gitlab.example.com/oauth/token`. Only for the `gitOAuth` type                                                                                                                   |
| `spec.gitOAuth.scopes`                 | OAuth scopes to request. The scopes must grant read and write access to your repositories. Only for the `gitOAuth` type                                                                                                                         |
| `spec.webhook.disabled`                | Disable webhooks for this connection (true/false). When `true`, the GitHub App doesn't need the `webhooks:write` permission, and Grafana doesn't register or receive webhook events. Use it if Grafana isn't reachable from the public internet |
| `secure.privateKey.create`             | Private key of the GitHub App, base64-encoded. Only for the `github` and `githubEnterprise` types                                                                                                                                               |
| `secure.clientSecret.create`           | Client secret of the OAuth App. Required for all OAuth connection types                                                                                                                                                                         |

### Repository parameters

In the following table, replace `<TYPE>` with the repository type set in `spec.type`. For example, use `spec.gitlab.url` for a GitLab repository.

| Field                                        | Description                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metadata.name`                              | Unique identifier for this repository resource                                                                                                                                                                                                                                                                                                     |
| `spec.title`                                 | Human-readable name displayed in Grafana UI                                                                                                                                                                                                                                                                                                        |
| `spec.description`                           | Description of the repository                                                                                                                                                                                                                                                                                                                      |
| `spec.type`                                  | Repository type: `github`, `githubEnterprise`, `gitlab`, `bitbucket`, or `git`                                                                                                                                                                                                                                                                     |
| `spec.<TYPE>.url`                            | Repository URL, for example `https://github.com/example/test`                                                                                                                                                                                                                                                                                      |
| `spec.<TYPE>.branch`                         | Branch to sync                                                                                                                                                                                                                                                                                                                                     |
| `spec.<TYPE>.path`                           | Directory path in the repository that contains your Grafana resources, for example `grafana/`. Grafana ignores anything outside this path                                                                                                                                                                                                          |
| `spec.githubEnterprise.serverUrl`            | URL of your GitHub Enterprise Server instance, for example `https://ghes.example.com`                                                                                                                                                                                                                                                              |
| `spec.bitbucket.tokenUser`                   | User that owns the Personal Access Token                                                                                                                                                                                                                                                                                                           |
| `spec.bitbucket.email`                       | Atlassian account email used to authenticate with the Bitbucket REST API. Required to enable webhooks                                                                                                                                                                                                                                              |
| `spec.git.tokenUser`                         | User that owns the Personal Access Token                                                                                                                                                                                                                                                                                                           |
| `spec.github.generateDashboardPreviews`      | Generate dashboard preview images in pull requests (true/false). Only for the `github` type. For other types, use `spec.pullRequest.generateDashboardPreviews`                                                                                                                                                                                     |
| `spec.connection.name`                       | Name of the connection resource used to authenticate. Use it instead of `secure.token` when you connect with a GitHub App or an OAuth App                                                                                                                                                                                                          |
| `spec.sync.enabled`                          | Enable synchronization (true/false)                                                                                                                                                                                                                                                                                                                |
| `spec.sync.intervalSeconds`                  | Sync interval in seconds. If the value is lower than the system minimum, Grafana uses the system minimum instead                                                                                                                                                                                                                                   |
| `spec.sync.target`                           | Where to place synced resources (`folder` or `folderless`)                                                                                                                                                                                                                                                                                         |
| `spec.workflows`                             | Enabled workflows: `write` (direct commits), `branch` (PRs). The order defines which workflow takes precedence. If empty, the repository is read-only                                                                                                                                                                                              |
| `spec.commit.singleResourceMessageTemplate`  | Template for the commit messages of single-resource operations in the Grafana UI, such as saving, moving, or deleting a dashboard. Supports `{{action}}`, `{{resourceKind}}`, `{{resourceID}}`, `{{title}}`, `{{userName}}`, `{{userLogin}}`, and `{{userEmail}}`. If empty, Grafana uses a default message, for example `Save dashboard: <TITLE>` |
| `spec.commit.enforceTemplate`                | Pre-fill the comment field in the save drawer from the commit message template and make it read-only (true/false)                                                                                                                                                                                                                                  |
| `spec.commit.authorName`                     | Name used as the commit author instead of the user who made the change. Only valid if `spec.commit.signingMethod` isn't set                                                                                                                                                                                                                        |
| `spec.commit.authorEmail`                    | Email used as the commit author instead of the user who made the change. Only valid if `spec.commit.signingMethod` isn't set                                                                                                                                                                                                                       |
| `spec.commit.signingMethod`                  | Method used to sign commits with the key in `secure.commitSigningKey`: `gpg`, `ssh`, or `smime`. If empty, commits aren't signed                                                                                                                                                                                                                   |
| `spec.commit.signerName`                     | Name of the commit signer. Must match the identity of the signing key for your Git provider to mark commits as verified. Defaults to `Grafana`                                                                                                                                                                                                     |
| `spec.commit.signerEmail`                    | Email of the commit signer. Must match the identity of the signing key, and a verified email on the account where the matching public key is registered. Defaults to `noreply@grafana.com`                                                                                                                                                         |
| `spec.commit.signerIsAuthor`                 | Use the signer identity (`signerName` and `signerEmail`) as the commit author (true/false)                                                                                                                                                                                                                                                         |
| `spec.commit.smimeCertificate`               | PEM-encoded X.509 certificate paired with the signing key. Only used if `spec.commit.signingMethod` is `smime`                                                                                                                                                                                                                                     |
| `spec.branch.nameTemplate`                   | Template for the names of branches created by the `branch` workflow. Supports `{{action}}`, `{{resourceKind}}`, `{{title}}`, `{{userLogin}}`, and `{{random}}`, a random 6-character string. Grafana converts the result to a valid branch name of up to 100 characters                                                                            |
| `spec.branch.enforceTemplate`                | Make the branch name field in the save drawer read-only (true/false)                                                                                                                                                                                                                                                                               |
| `spec.pullRequest.titleTemplate`             | Template for pull request titles. Supports the same variables as `spec.branch.nameTemplate`. If empty, Grafana uses the first line of the commit message                                                                                                                                                                                           |
| `spec.pullRequest.enforceTemplate`           | Make the pull request title field in the save drawer read-only (true/false)                                                                                                                                                                                                                                                                        |
| `spec.pullRequest.generateDashboardPreviews` | Generate dashboard preview images in pull requests (true/false). For all types except `github`                                                                                                                                                                                                                                                     |
| `spec.webhook.baseUrl`                       | Base URL of your Grafana instance used to register webhooks with your Git provider, for example `https://grafana.example.com`. Overrides the auto-detected public URL of Grafana                                                                                                                                                                   |
| `spec.webhook.disabled`                      | Disable webhooks for this repository (true/false). When `true`, Grafana polls the repository at the sync interval instead. Use it if Grafana isn't reachable from the public internet                                                                                                                                                              |
| `secure.token.create`                        | Personal Access Token of your Git provider. Not needed if you use `spec.connection.name`                                                                                                                                                                                                                                                           |
| `secure.commitSigningKey.create`             | Private key used to sign the commits Grafana writes to the repository. The format depends on `spec.commit.signingMethod`                                                                                                                                                                                                                           |

## Push the resources to Grafana

Before pushing any resources, configure `gcx` with your Grafana instance details. Refer to the [Grafana CLI documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/ai-tools/grafana-cli/) for setup instructions.

Next, push the connection (if required) and repository configuration files:

```sh
gcx resources push --path <DIRECTORY>
```

The `--path` parameter has to point to the directory containing your `repository.yaml` and `connection.yaml` files.

After pushing, Grafana will:

1. Create the required resources (repository and, for GitHub App or OAuth, connection).
1. Connect to your GitHub repository.
1. Pull dashboards from the specified path.
1. Begin syncing at the configured interval.

## Manage repository resources

### List repositories

To list all repositories:

```sh
gcx resources get repositories
```

### Get repository details

To get details for a specific repository:

```sh
gcx resources get repository/<REPOSITORY_NAME>
gcx resources get repository/<REPOSITORY_NAME> -o json
gcx resources get repository/<REPOSITORY_NAME> -o yaml
```

### Update the repository

To update a repository:

```sh
gcx resources edit repository/<REPOSITORY_NAME>
```

### Delete the repository

To delete a repository:

```sh
gcx resources delete repository/<REPOSITORY_NAME>
```

## Verify setup

Check that Git Sync is working:

```sh
# List repositories
gcx resources get repositories

# Check Grafana UI
# Navigate to: Administration → Provisioning → Git Sync
```
