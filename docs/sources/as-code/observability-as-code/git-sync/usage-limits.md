---
description: Git Sync usage tiers, compatible Git providers, and known limitations.
keywords:
  - as code
  - as-code
  - dashboards
  - git integration
  - git sync
  - github
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Usage and performance limitations
menuTitle: Usage limitations
weight: 110
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/usage-limits/
refs:
  roles-and-permissions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/cloud-roles/
aliases:
---

# Usage and performance limitations

{{< admonition type="note" >}}

Git Sync functionalities are constantly evolving. [Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

## Performance considerations

When Git Sync is enabled, the database load might increase, especially if your Grafana instance has many folders and nested folders. Evaluate the performance impact, if any, in a non-production environment.

## Usage tiers and limits

The following Git Sync per-tier limits apply:

| Tier                                      | **Cloud - Free** | **Cloud - Other** | **On-prem OSS** | **On-prem Enterprise** |
| ----------------------------------------- | ---------------- | ----------------- | --------------- | ---------------------- |
| Amount of repositories                    | 1                | 10                | 10 (default)    | 10 (default)           |
| Amount of synced resources per repository | 20               | 1,000             | 1,000 (default) | 1,000 (default)        |

{{< admonition type="note" >}}

On self-managed Grafana (OSS or Enterprise), the table values for repositories (**10**) and resources per repository (**1,000**) are **defaults**, not hard ceilings. Change them with `[provisioning] max_repositories` and `[provisioning] max_resources_per_repository` in the Grafana configuration file (`0` means unlimited for either setting). Refer to [`max_repositories`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#max_repositories), [`max_resources_per_repository`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#max_resources_per_repository), and [Modify your usage limits](#modify-your-usage-limits).

On Grafana Cloud, tier limits can't be changed from configuration. Contact Support if you need a higher connection limit, or prefer [sharding by capacity](#shard-by-capacity-not-by-team) instead of one connection per team or microservice.

{{< /admonition >}}

**Do not sync more than 1,000 resources per repository connection as of today.** This isn't an arbitrary cap: beyond roughly 1,000 resources per connection, the sync workflow puts noticeable load on Grafana itself, which may result in slower syncs and increased database load. In any case, Git Sync is under continuous development and the recommended ceiling will increase in upcoming releases.

On Grafana Cloud, the repository-connection limit is a per-stack limit. On self-managed Grafana, the effective limit is whatever you set for `max_repositories` (default `10`).

Both of these limits are early figures. As Git Sync matures, these limits will raise by orders of magnitude. The goal is for Git Sync to support around 100 repository connections per stack, and up to roughly 1,000 in the longer term, with similar increases to the number of resources you can sync per connection.

If these limits are affecting your use of Git Sync, [get in touch](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developer-resources/contribute/#communicate-with-grafana) and explain your situation, or share any idea or suggestion.

For details on usage and storage limits, refer to [Dashboard and folder limits](https://grafana.com/docs/grafana-cloud/cost-management-and-billing/manage-invoices/understand-your-invoice/usage-limits/#other-usage-limits).

### Scale beyond 1,000 resources per repository

If a single repository holds more than 1,000 resources, you don't have to raise the per-repository limit. Instead, connect the same repository multiple times, with each connection pointing to a different folder (path) in the repository. Each connection syncs its own subset of resources and counts toward the 1,000-resource recommendation independently.

Because a stack allows up to 10 repository connections, this lets you sync up to roughly 10,000 resources from a single repository while keeping each connection within the recommended range.

When you split a single repository across several connections, use [folderless sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts#sync-targets) for each connection. With folder sync (the default), every connection creates its own wrapper folder named after the repository, so splitting the repository would change your folder hierarchy and nest resources one level deeper. Folderless sync places each connection's resources at the top level, so the split has no effect on how your dashboards and folders are organized in Grafana.

If you need more than that, the 10-connection limit can be increased slightly for Cloud stacks on request. Contact Support to discuss your use case.

On Grafana Cloud, syncing this many resources may also exceed your stack's maximum number of dashboards. If it does, you'll need to increase that limit as well. Refer to [Dashboard and folder limits](https://grafana.com/docs/grafana-cloud/cost-management-and-billing/manage-invoices/understand-your-invoice/usage-limits/#other-usage-limits) to review and adjust your dashboard limits.

#### Shard by capacity, not by team

When you have many teams or tenants, it's tempting to create one connection per team so each team maps to its own connection. Avoid this: it consumes connections quickly, doesn't scale as teams grow, and on Grafana Cloud a single stack can't be granted the hundreds of connections this would require.

Instead, shard by capacity. Create one repository and group teams into a small number of shard folders, each holding up to about 1,000 resources, and connect each shard folder separately. For example, a customer with 190 teams and 900 resources fits comfortably in a single shard today:

```
your-org/grafana-manifests/
├── shard-1/        ← ~900 resources today, connected now
│   ├── team-a/
│   ├── team-b/
│   └── ...
├── shard-2/        ← empty for now, add a connection when shard-1 approaches 1,000
├── shard-3/        ← add later as you keep growing
└── shard-4/        ← ...up to 10 shards / connections per stack
```

As the number of resources grows, add `shard-2`, `shard-3`, and later shards, and connect each one. You can move teams between shards at any time to balance the load, so you only pay for the connections you actually need and can grow up to the 10-connection limit without restructuring your repository.

If sharding isn't practical for your setup, try raising the per-connection resource limit modestly, for example from 1,000 to a limit in the 1,200 - 1,500 range. This is a small adjustment for a bit of extra headroom, not an order-of-magnitude increase. Still, do not go beyond 1,500 resources per connection because of the performance impact on Grafana. For substantially larger scales, sharding remains the recommended approach.

### Modify your usage limits

Before changing your usage limits, study your specific use case. Design the repository structure carefully, and determine how many repositories and how many resources you can support. For example, setting over 1,000 resources per repository may impact your system's performance.

On Grafana Cloud, limit increases aren't granted automatically. When you request one, Support will ask you to describe your use case to understand why the current limits aren't enough, and assess whether the increase is necessary and safe for your stack's performance. On-prem users don't need to make a request: you can change the limits directly through configuration settings, as described below. In many cases, splitting a single repository across multiple connections, as described in [Scale beyond 1,000 resources per repository](#scale-beyond-1000-resources-per-repository), is a better option than raising the limits.

How you change the limits depends on your deployment:

- **Grafana Cloud**: Limits are enforced per tier and can't be edited from configuration. The 10-connection limit can be increased slightly on request — contact Support to discuss your use case. Splitting a single repository across multiple connections (see [Scale beyond 1,000 resources per repository](#scale-beyond-1000-resources-per-repository)) is the recommended way to sync more resources without changing tier limits.
- **On-prem (OSS or Enterprise)**: The table values of **10** repositories and **1,000** resources per repository are defaults, not hard ceilings. You can customize both limits through configuration settings (see below). Prefer splitting a single repository across connections when you need more resources, rather than raising `max_resources_per_repository` far above the recommended range.

On-prem users can customize the limits with the following configuration settings:

- Use `max_repositories` to set how many repositories you can sync. Default is `10`. Set to `0` for unlimited repositories. Refer to [`max_repositories`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#max_repositories) in the Configure Grafana section to learn more.
- Use `max_resources_per_repository` to set the amount of resources per repository to sync. Default is `1000`. Set to `0` for unlimited resources. Refer to [`max_resources_per_repository`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#max_resources_per_repository) in the Configure Grafana section to learn more.

### Nested folders

Git Sync supports up to four nested folders within a repository.

### Git Sync across multiple organizations

Git Sync works across multiple organizations for self-managed Grafana instances. You can set up Git Sync independently in each of your organizations, and what you sync in one organization does not affect another. Teams that share a single Grafana instance across separate organizations can each manage their own provisioning from Git.

This feature is available starting in Grafana 13.0.4, but not supported until Grafana 13.1.1.

## Compatible Git providers

Git Sync is available for any Git provider through a Pure Git repository type, and has specific enhanced integrations for GitHub, GitLab and Bitbucket.

| **Provider** | **Available in**       | **Authentication**                  |
| ------------ | ---------------------- | ----------------------------------- |
| Pure Git     | Cloud, OSS, Enterprise | Personal Access Token               |
| GitHub       | Cloud, OSS, Enterprise | Personal Access Token or GitHub App |
| GitLab       | Cloud, Enterprise      | Personal Access Token               |
| Bitbucket    | Cloud, Enterprise      | API token with scopes               |

Note that Pure Git, GitLab and Bitbucket are supported in Grafana v12.4.x or later only. Refer to [Enable Git providers](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-before#enable-git-providers) to set them up.

To learn more about Git, refer to [Getting Started - About Version Control](https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control) of the [Pro Git book](https://git-scm.com/book/en/v2) in the official Git documentation.

### The Pure Git repository type

The Pure Git repository type uses the [Smart HTTP protocol v2](https://git-scm.com/docs/protocol-v2) (Git over HTTPS), with no provider-specific logic. Pure Git delivers the core Git Sync workflow: your repository is the source of truth, you may edit dashboards in the UI, and Grafana stays in sync.

{{< admonition type="note" >}}

Pure Git only supports **Smart HTTP protocol v2**. Earlier protocol versions (v1, v0) and SSH transport are not supported.

Make sure your Git server supports protocol v2 over HTTPS. Some providers, like Azure DevOps, only use v1 and are therefore not compatible with Git Sync.

{{< /admonition >}}

However, Pure Git doesn't include any features that require provider APIs, such as webhook-driven instant sync, automated PR comments, or deep links to source files.

### Enhanced integrations: GitHub, GitHub Enterprise, GitLab, Bitbucket

If your Git provider is GitHub, GitLab, or Bitbucket, use the enhanced integration. Enhanced integrations understand the platform you're using, allowing workflows that feel native: automated pull request comments with dashboard previews, instant webhook-based sync, or direct navigation from Grafana to source files in your provider's UI.

The GitHub enhanced integration is the most feature-complete experience today. It enables richer pull request workflows, deeper linking between Grafana and GitHub, and tighter integration into review processes. It is available in Grafana OSS, Enterprise, and Cloud.

{{< admonition type="note" >}}

**GitHub Enterprise Server** is currently only supported through the Pure Git repository type. A dedicated enhanced integration for GitHub Enterprise Server is planned for upcoming releases.

{{< /admonition >}}

The GitLab and Bitbucket integrations have limited functionality for the moment, and are only available in Grafana Enterprise and Grafana Cloud. Expect continued improvements around pull request workflows, linking, and sync behavior in upcoming releases.

## Resource support and compatibility

**Git Sync only supports dashboards and folders**. Alerts, data sources, panels and other resources are not supported yet.

If you're a Grafana Cloud user, you can check the [Grafana roadmap portal](https://grafana.ideas.aha.io/ideas) to learn about future improvements.

### Resource compatibility

If you're using Git Sync in Grafana OSS or Grafana Enterprise, some supported resources might be in an incompatible data format. If this happens, syncing will be blocked. Compatibility issues will be fixed with an upcoming migration tool.

A resource can be:

| Is the resource? | **Compatible**                                                             | **Incompatible**                                                                                |
| ---------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Supported**    | The resource can be managed with Git Sync.                                 | The resource is supported but has compatibility issues. It **cannot** be managed with Git Sync. |
| **Unsupported**  | The resource is **not** supported and **cannot** be managed with Git Sync. | Not applicable.                                                                                 |

## Known limitations

### Migration to Git Sync

**Full-instance sync is experimental.**

When migrating to resources to Git Sync, you can still create, edit or delete resources, but changes may not be exported. The duration of this process depends on the number of resources involved.

When migrating existing dashboards, the folder structure will be replicated in the repository. You may need to manually remove or manage original folders after the migration.

### Use existing resources

If you want to manage existing resources with Git Sync, you can save them from the UI, save them as JSON files and commit them to the synced repository, or use `gcx`. Refer to [Export non-provisioned resources from Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/export-resources) for more details.

### Restore resources

Restoring resources from the UI is currently not possible. As an alternative, you can restore dashboards directly in your GitHub repository by raising a PR, and they will be updated in Grafana.
