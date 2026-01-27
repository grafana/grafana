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
title: Git Sync known issues and limitations
menuTitle: Known issues and limits
weight: 100
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/known-issues/
refs:
  roles-and-permissions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/cloud-roles/
aliases:
---

# Git Sync known issues and limitations

{{< admonition type="caution" >}}

Git Sync is available in [private preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud, and is an [experimental feature](https://grafana.com/docs/release-life-cycle/) in Grafana v12 for open source and Enterprise editions.

Support and documentation is available but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

You can sign up to the private preview using the [Git Sync early access form](https://forms.gle/WKkR3EVMcbqsNnkD9).

{{< /admonition >}}

## Performance considerations

When Git Sync is enabled, the database load might increase, especially if your Grafana instance has many folders and nested folders. Evaluate the performance impact, if any, in a non-production environment.

## Git Sync limits

TBD

## Known issues

**Git Sync is under development and the following applies.**

### Synced resources

- You can only sync dashboards and folders. Refer to [Supported resources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/git-sync/#resource-support-and-compatibility) for more information.
- If you're using Git Sync in Grafana OSS and Grafana Enterprise, some resources might be in an incompatible data format and won't be synced.
- Full-instance sync is not available in Grafana Cloud and is experimental in Grafana OSS and Grafana Enterprise. 
- When migrating to full instance sync, during the synchronization process your resources will be temporarily unavailable. No one will be able to create, edit, or delete resources during this process.
- If you want to manage existing resources with Git Sync, you need to save them as JSON files and commit them to the synced repository. Open a PR to import, copy, move, or save a dashboard.
- Restoring resources from the UI is currently not possible. As an alternative, you can restore dashboards directly in your GitHub repository by raising a PR, and they will be updated in Grafana.

### Authentication

- You can only authenticate in GitHub using your Personal Access Token token.

### Permission management

- You cannot modify the permissions of a provisioned folder after you've synced it.
- Default permissions are: Admin = Admin, Editor = Editor, and Viewer = Viewer. Refer to [Roles and permissions](ref:roles-and-permissions) for more information.

### Compatibility

- Support for native Git, Git app, and other providers, such as GitLab or Bitbucket, is on the roadmap.


