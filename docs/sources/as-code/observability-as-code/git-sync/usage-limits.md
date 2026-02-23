---
description: Key concepts to understand how Git Sync works.
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

**Git Sync is under development.** [Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

## Performance considerations

When Git Sync is enabled, the database load might increase, especially if your Grafana instance has many folders and nested folders. Evaluate the performance impact, if any, in a non-production environment.

## Compatible services and providers

At the moment Git Sync is available for GitHub only. Support for native Git and other providers, such as GitLab or Bitbucket, is on the roadmap.

## Usage tiers

The following Git Sync per-tier limits apply:

| Tier                                      | **Cloud - Free** | **Cloud - Other** | **On-prem OSS** | **On-prem Enterprise** |
| ----------------------------------------- | ---------------- | ----------------- | --------------- | ---------------------- |
| Amount of repositories                    | 1                | 10                | 10              | 10                     |
| Amount of synced resources per repository | 20               | Grafana limit     | No limit        | No limit               |

## Authentication

You can authenticate in GitHub using a Personal Access Token token or GitHub App. Refer to [Set up Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup) for more details.

## Known issues

### Synced resources

- You can only sync dashboards and folders. Refer to [Supported resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/#resource-support-and-compatibility) for more information.
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
