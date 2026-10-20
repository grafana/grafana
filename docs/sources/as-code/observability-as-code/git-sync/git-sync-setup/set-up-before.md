---
description: Prerequisites for Git Sync, so you can provision GitHub repositories for use with Grafana.
keywords:
  - set up
  - git integration
  - git sync
  - github
  - prerequisites
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Setup prerequisites
weight: 110
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/git-sync-setup/set-up-before/
aliases:
---

# Before you begin

Before you begin to set up Git Sync, ensure you have the following:

- A Grafana instance (Cloud, OSS, or Enterprise)
- Administration rights in your Grafana organization
- A [Git provider](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits#compatible-providers)
- If you're [using webhooks or image rendering](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-extend), a public instance with external access
- Optional: The [Image Renderer service](https://github.com/grafana/grafana-image-renderer) to save image previews with your PRs

## Enable required feature toggles

The `provisioning` feature toggle is enabled by default in Grafana Cloud and, starting in Grafana v13, for OSS and Enterprise as well. No manual configuration is required.

For more information about feature toggles, refer to [Configure feature toggles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/).

## Enable Git providers

If you're using Grafana Enterprise v12.4.0 and want to set up Git Sync with pure Git, GitLab or Bitbucket, or if you're using Grafana OSS v12.4.0 and want to set up Git Sync with pure Git, add them to your configuration file:

1. Open your Grafana configuration file, either `grafana.ini` or `custom.ini`.
1. Add the available providers:

   ```ini
   [provisioning]
   repository_types = "git|github|bitbucket|gitlab|local"
   ```

1. Save the changes to the file and restart Grafana.

## Enable OAuth connection types

If you're using self-managed Grafana and the OAuth App connection type for your provider isn't available, add it to `connection_types` in your configuration file:

1. Open your Grafana configuration file, either `grafana.ini` or `custom.ini`.
1. Add the connection types:

   ```ini
   [provisioning]
   connection_types = "github|githubOAuth|gitOAuth"
   ```

1. Save the changes to the file and restart Grafana.

The available OAuth connection types are:

| **Connection type**     | **Provider**      | **Available in** |
| ----------------------- | ----------------- | ---------------- |
| `githubOAuth`           | GitHub            | OSS, Enterprise  |
| `gitOAuth`              | Pure Git          | OSS, Enterprise  |
| `githubEnterpriseOAuth` | GitHub Enterprise | Enterprise       |
| `gitlabOAuth`           | GitLab            | Enterprise       |
| `bitbucketOAuth`        | Bitbucket         | Enterprise       |

## Network connectivity and IP allowlisting

Git Sync requires network connectivity between your Grafana instance and Git server. Understanding the traffic patterns helps you configure firewall rules and allowlists correctly.

### Traffic types

Git Sync uses two types of network traffic:

- **Sync operations (pull and push)**: From Grafana to the Git Server
  - Egress traffic from Hosted Grafana IP addresses
  - Your Git servers must allow inbound traffic from these IP addresses
  - For a list of IP addresses to add to your Git server's allowlist, refer to [Hosted Grafana source IPs](https://grafana.com/docs/grafana-cloud/security-and-account-management/allow-list/#hosted-grafana)
- **Webhooks (instantaneous sync)**: From the Git Server to Grafana stack
  - Inbound traffic to the stack's public endpoint
  - Your Git server must be able to reach `*.grafana.net`
  - Required only if you're [using webhooks](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-extend)

### AWS PrivateLink and Private Data Source Connect

Git Sync doesn't route over AWS PrivateLink or Private Data Source Connect (PDC). Instead, Git Sync uses the normal public path from the Hosted Grafana IPs, which is independent from PrivateLink and PDC. AWS PrivateLink and PDC provide a separate tunnel for data source query traffic, from Grafana to your private databases or data sources.

**If you use AWS PrivateLink or PDC for data sources, you can still use Git Sync**. The two features neither interfere with nor depend on each other.

## Allow internal or private Git servers

{{< admonition type="note" >}}
This setting is available for Grafana v13.0.4 and Grafana v13.1.1 and later. It only applies to self-managed Grafana (OSS and Enterprise), but it's not configurable in Grafana Cloud.
{{< /admonition >}}

While public Git servers such as `github.com`, `gitlab.com`, and `bitbucket.org` resolve to public addresses and are always allowed, by default Git Sync rejects repository URLs with a host that resolves to a loopback, a private (RFC 1918), link-local, or an unspecified address. This protects your Grafana instance against server-side request forgery (SSRF).

If you connect Git Sync to a Git server on a private network such as a self-hosted GitHub Enterprise, GitLab, or Bitbucket instance reachable only through an internal address, add its host to the `allowed_git_urls` allowlist:

1. Open your Grafana configuration file, either `grafana.ini` or `custom.ini`.
1. Add each internal Git host to `allowed_git_urls` as a comma-separated list:

   ```ini
   [provisioning]
   allowed_git_urls = git.internal.example.com, ghe.example.com:8443
   ```

1. Save the changes to the file and restart Grafana.

Each entry can be a hostname, `host:port`, a full URL (only the host is used), a literal IP address, or a CIDR range. If possible, use specific hosts or narrow ranges, since a broad CIDR such as `10.0.0.0/8` re-exposes the entire private range that SSRF protection blocks.

**Only add hosts you trust** because an allowlisted host receives the configured Git token on every sync, fetch, and push.

## Resource and role permissions

By default, folders provisioned with Git Sync have these roles:

- Admin = Admin
- Editor = Editor
- Viewer = Viewer.

Refer to [Git Sync permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/permissions-grafana) for details on how to set up permissions in Git Sync. To modify them, refer to [Manage folder permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/use-git-sync#manage-folder-permissions).

Refer to [Roles and permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions) for more information about Grafana roles.

## Create a GitHub App

GitHub Apps are tools that extend GitHub functionality. They use fine-grained permissions and short-lived tokens, giving you more control over which repositories are being accessed. Find out more in the [GitHub Apps official documentation](https://docs.github.com/en/apps/overview).

If you chose to authenticate with a newly created GitHub App, you'll need the following parameters:

- GitHub App ID
- GitHub App Private Key
- GitHub App Installation ID

There are many ways to create a GitHub App. The following instructions are informative only, always refer to official GitHub documentation for more details.

To create the GitHub App, follow these steps:

1. Go to https://github.com/settings/apps and click on **New Github App**, or navigate directly to https://github.com/settings/apps/new
1. Fill in the following fields:
   - Name: Must be unique
   - Homepage URL: For example, your Grafana Cloud instance URL
1. Scroll down to the **Webhook** section and uncheck the **Active** box
1. In the **Permissions** section, go to **Repository permissions** and set these parameters:
   - **Administration**: Read-only permission (enables validation of branch protection rules against the configured branch when users can push directly to it; may be used in the future to check other repository settings and make the setup process smoother)
   - **Contents**: Read and write permission
   - **Metadata**: Read-only permission
   - **Pull requests**: Read and write permission
   - **Webhooks**: Read and write permission
1. Finally, under **Where can this GitHub App be installed?**, select **Only on this account**
1. Click on **Create Github App** to complete the process.

On the app page:

1. Copy the **AppID** from the **About** section
1. Select the **Generate private key** from the banner or scroll down to to the **Private Keys** section to generate a key
1. A PEM file containing your private key will be downloaded to your computer

Finally, install the app:

1. At the top left of the App page, click on **Install App**
1. Choose for which user you need to install it, you’ll be redirected to the repository selection screen
1. Choose for which repositories you want to install the app
1. Click **Install**.
1. On the installation page, copy **`installationID`** from the page URL https://github.com/settings/installations/installationID

You can now proceed to [Set up Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/)!

## Create an OAuth App

An OAuth App lets Grafana act on your behalf in your Git provider. You create the app in your provider, then authorize it once from Grafana. Grafana stores the access token and refreshes it when the provider supports refresh tokens.

{{< admonition type="caution" >}}
An OAuth App connection acts as the user who authorized it. Every repository that uses the connection and every user who can run its sync jobs will use the access token of the user that authorized the connection. The token can reach every repository that user can access, not only those connected to Grafana. Removing the user from Grafana doesn't revoke the token. Revoke it in your Git provider.

To limit access, authorize the app with a dedicated account that can only access the repositories you sync. For GitHub, consider a GitHub App, which is scoped to the repositories where it's installed.
{{< /admonition >}}

If you chose to authenticate with an OAuth App, you need the following parameters:

- The client ID of the app.
- The client secret of the app.

Every OAuth App needs the Grafana callback URL. Grafana shows it in the setup wizard, and it has this format:

```text
<GRAFANA_URL>/admin/provisioning/connections/oauth-callback
```

Replace _`<GRAFANA_URL>`_ with the root URL of your Grafana instance, including any sub-path.

The following instructions are informative only. Always refer to the official documentation of your Git provider for more details.

### GitHub and GitHub Enterprise

To create a GitHub OAuth App, follow these steps:

1. In GitHub, go to **Settings > Developer settings > OAuth apps** and click **New OAuth App**. For GitHub Enterprise, use the same menu on your enterprise instance.
1. Enter an **Application name** and a **Homepage URL**, for example your Grafana instance URL.
1. Paste the Grafana callback URL in **Authorization callback URL**.
1. Click **Register application**.
1. Copy the **Client ID**, then click **Generate a new client secret** and copy the secret.

Grafana requests the `repo` scope when you authorize the app. For more details, refer to [Creating an OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app).

### GitLab

To create a GitLab OAuth application, follow these steps:

1. In GitLab, create the application for your user or for a group:
   - For your user, select your avatar, then **Edit profile > Access > Applications > Add new application**.
   - For a group, go to the group and select **Settings > Applications**.
1. Enter a **Name** and paste the Grafana callback URL in **Redirect URI**.
1. Keep **Confidential** selected, and select the `api` scope.
1. Click **Save application**.
1. Copy the **Application ID** and the **Secret**.

For more details, refer to [Configure GitLab as an OAuth 2.0 authentication identity provider](https://docs.gitlab.com/integration/oauth_provider/).

### Bitbucket

To create a Bitbucket OAuth consumer, follow these steps:

1. In Bitbucket, go to **Workspace settings > Apps and features > OAuth consumers** and click **Add consumer**.
1. Enter a **Name** and paste the Grafana callback URL in **Callback URL**.
1. Set these permissions:
   - **Repositories**: Read and write permission
   - **Pull requests**: Read and write permission
   - **Webhooks**: Read and write permission
1. Click **Save**.
1. Select the consumer name to show the **Key** and the **Secret**, copy them, and note the name of the workspace.

For more details, refer to [Use OAuth on Bitbucket Cloud](https://support.atlassian.com/bitbucket-cloud/docs/use-oauth-on-bitbucket-cloud/).

### Other Git providers

For any other Git provider that supports the OAuth 2.0 authorization code flow, create an OAuth application with the Grafana callback URL as the redirect URI. In addition to the client ID and secret, you need:

- The **Authorization URL** of the provider, for example `https://git.example.com/oauth/authorize`.
- The **Token URL** of the provider, for example `https://git.example.com/oauth/token`.
- The **Scopes** that grant read and write access to your repositories. Refer to your provider's documentation.

Both URLs must use `https://`, unless you set `allow_insecure` in the `[provisioning]` section of your configuration file.

## Next steps

For further details on how Git Sync operates, refer to:

- [Git Sync key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts)
- [Git Sync supported resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/#supported-resources)
- [Git Sync usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits)
