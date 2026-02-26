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

{{< admonition type="caution" >}}

Git Sync is available in [public preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud, and is an [experimental feature](https://grafana.com/docs/release-life-cycle/) in Grafana v12 for open source and Enterprise editions. Documentation and support is available **based on the different tiers** but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

**Git Sync is under development.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) for more information. [Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

## Performance considerations

When Git Sync is enabled, the database load might increase, especially if your Grafana instance has many folders and nested folders. Evaluate the performance impact, if any, in a non-production environment.

## Usage tiers

The following Git Sync per-tier limits apply:

| Tier                                      | **Cloud - Free** | **Cloud - Other** | **On-prem OSS** | **On-prem Enterprise** |
| ----------------------------------------- | ---------------- | ----------------- | --------------- | ---------------------- |
| Amount of repositories                    | 1                | 10                | 10              | 10                     |
| Amount of synced resources per repository | 20               | Grafana limit     | No limit        | No limit               |

## Compatible Git providers

Git Sync is available for any Git provider through a Pure Git repository type, and has specific enhanced integrations for GitHub, GitLab and Bitbucket.

| **Provider** | **Available in**       | **Authentication**                  |
| ------------ | ---------------------- | ----------------------------------- |
| Pure Git     | Cloud, OSS, Enterprise | Personal Access Token               |
| GitHub       | Cloud, OSS, Enterprise | Personal Access Token or GitHub App |
| GitLab       | Cloud, Enterprise      | Personal Access Token               |
| Bitbucket    | Cloud, Enterprise      | API token with scopes               |

### The Pure Git repository type

The Pure Git repository type uses the standard Git over HTTP protocol, with no provider-specific logic. Pure Git delivers the core Git Sync workflow: your repository is the source of truth, you may edit dashboards in the UI, and Grafana stays in sync.

However, Pure Git doesn't include any features that require provider APIs, such as webhook-driven instant sync, automated PR comments, or deep links to source files.

### Enhanced integrations: GitHub, GitLab, Bitbucket

If your Git provider is GitHub, GitLab, or Bitbucket, use the enhanced integration. Enhanced integrations understand the platform you're using, allowing workflows that feel native: automated pull request comments with dashboard previews, instant webhook-based sync, or direct navigation from Grafana to source files in your provider's UI.

The GitHub enhanced integration is the most feature-complete experience today. It enables richer pull request workflows, deeper linking between Grafana and GitHub, and tighter integration into review processes. It is available in Grafana OSS, Enterprise, and Cloud.

The GitLab and Bitbucket integrations have limited functionality for the moment, and are only available in Grafana Enterprise and Grafana Cloud. Expect continued improvements around pull request workflows, linking, and sync behavior in upcoming releases.

## Resource support and compatibility

Git Sync only supports dashboards and folders. Alerts, panels, and other resources are not supported yet.

If you're using Git Sync in Grafana OSS or Grafana Enterprise, some supported resources might be in an incompatible data format. If this happens, syncing will be blocked. Compatibility issues will be fixed with an upcoming migration tool.

A resource can be:

| Is the resource? | **Compatible**                                                             | **Incompatible**                                                                                |
| ---------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Supported**    | The resource can be managed with Git Sync.                                 | The resource is supported but has compatibility issues. It **cannot** be managed with Git Sync. |
| **Unsupported**  | The resource is **not** supported and **cannot** be managed with Git Sync. | Not applicable.                                                                                 |

## Known limitations

### Synced resources

- You can only sync dashboards and folders. Refer to [Supported resources](#resource-support-and-compatibility) for more information.
- If you're using Git Sync in Grafana OSS and Grafana Enterprise, some resources might be in an incompatible data format and won't be synced.
- Full-instance sync is not available in Grafana Cloud and is experimental in Grafana OSS and Grafana Enterprise.
- When migrating to full instance sync, during the synchronization process your resources will be temporarily unavailable. No one will be able to create, edit, or delete resources during this process.
- If you want to manage existing resources with Git Sync, you need to save them as JSON files and commit them to the synced repository. Use `grafanactl` or open a PR to import, copy, move, or save a dashboard. Refer to [Export non-provisioned resources from Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/export-resources) for more details.
- Restoring resources from the UI is currently not possible. As an alternative, you can restore dashboards directly in your GitHub repository by raising a PR, and they will be updated in Grafana.

### Permission management

You cannot modify the permissions of a provisioned folder after you've synced it.

The default permissions are:

- Admin = Admin
- Editor = Editor
- Viewer = Viewer.

Refer to [Roles and permissions](ref:roles-and-permissions) for more information.
