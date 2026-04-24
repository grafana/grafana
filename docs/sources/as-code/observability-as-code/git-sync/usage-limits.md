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

**Git Sync is now GA for Grafana Cloud, OSS and Enterprise.**

[Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

## Performance considerations

When Git Sync is enabled, the database load might increase, especially if your Grafana instance has many folders and nested folders. Evaluate the performance impact, if any, in a non-production environment.

## Usage tiers

The following Git Sync per-tier limits apply:

| Tier                                      | **Cloud - Free** | **Cloud - Other** | **On-prem OSS** | **On-prem Enterprise** |
| ----------------------------------------- | ---------------- | ----------------- | --------------- | ---------------------- |
| Amount of repositories                    | 1                | 10                | 10              | 10                     |
| Amount of synced resources per repository | 20               | 1,000             | No limit        | No limit               |

### Modify your usage limits

Before changing your usage limits, study your specific use case. Define the governance you'd like to set when you design the repository structure and how many repositories and how many resources you can support. For example, setting over 1,000 resources per repository may impact your system's performance.

If you're a Cloud user, contact Support to modify the amount of repositories you can sync.

If you're an on-prem user, you can customize your limits via configuration settings:

- Use `max_repositories` to set the amount of repositories you can sync. Refer to [`max_repositories`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#max_repositories) in the Configure Grafana section to learn more.
- Use `max_resources_per_repository` to set the amount of resources per repository to sync. Refer to [`max_resources_per_repository`](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#max_resources_per_repository) in the Configure Grafana section to learn more.
  > > > > > > > c2f0b685470 (Docs: Updates to Git Sync limits (#123460))

## Compatible Git providers

Git Sync is available for any Git provider through a Pure Git repository type, and has specific enhanced integrations for GitHub, GitLab and Bitbucket.

| **Provider** | **Available in**       | **Authentication**                  |
| ------------ | ---------------------- | ----------------------------------- |
| Pure Git     | Cloud, OSS, Enterprise | Personal Access Token               |
| GitHub       | Cloud, OSS, Enterprise | Personal Access Token or GitHub App |
| GitLab       | Cloud, Enterprise      | Personal Access Token               |
| Bitbucket    | Cloud, Enterprise      | API token with scopes               |

Note that Pure Git, GitLab and Bitbucket are supported in Grafana v12.4.x or later only. Refer to [Enable Git providers](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/set-up-before#enable-git-providers) to set them up.

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
