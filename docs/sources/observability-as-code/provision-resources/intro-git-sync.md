---
description: Learn about Git Sync, the Grafana feature for storing and managing dashboards within GitHub repositories.
keywords:
  - dashboards
  - git integration
  - git sync
  - github
labels:
  products:
    - enterprise
    - oss
    - cloud
refs:
  roles-and-permissions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/account-management/authentication-and-permissions/cloud-roles/
title: Git Sync
weight: 100
---

# Introduction to Git Sync

{{< admonition type="caution" >}}

Git Sync is available in [private preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud, and is an [experimental feature](https://grafana.com/docs/release-life-cycle/) in Grafana v12 for open source and Enterprise editions.

Support and documentation is available but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

You can sign up to the private preview using the [Git Sync early access form](https://forms.gle/WKkR3EVMcbqsNnkD9).

{{< /admonition >}}

Git Sync in Grafana lets you manage your dashboards as code as JSON files stored in GitHub. You and your team can version control, collaborate, and automate deployments efficiently.

Using Git Sync, you can:

- Manage dashboard configuration outside of Grafana instances using Git
- Introduce a review process for creating and modifying dashboards
- Replicate dashboards across multiple instances

## How it works

{{< admonition type="caution" >}}

Git Sync only works with specific folders for the moment. Full-instance sync is not currently supported.

{{< /admonition >}}

Git Sync is bidirectional and works both with changes done directly in GitHub as well as in the Grafana UI.

### Provisioning folder

Git Sync creates a folder for all the synchronized resources to live under. You can continue to have unprovisioned resources outside that folder.

### Make changes in Grafana

Whenever you modify a dashboard directly from the UI, Grafana can commit changes to Git upon saving. You can configure settings to either enforce PR approvals before merging in your repository, or allow direct commits.

Grafana periodically polls GitHub at a regular internal to synchronize any changes. The default polling interval is 60 seconds, and you can change this setting in the Grafana UI.

- If you enable the [webhooks feature](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/git-sync-setup/#configure-webhooks-and-image-rendering), repository notifications appear almost immediately.
- Without webhooks, Grafana polls for changes at the specified interval.

### Make changes in your GitHub repositories

With Git Sync, you can make changes to the files in the provisioned folder in GitHub and see them in Grafana. Automated workflows ensure those changes are automatically represented in the Grafana database by updating Git. The Grafana UI reads the database and updates the UI to reflect these changes.

## Known limitations

{{< admonition type="caution" >}}

Refer to [Requirements](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/git-sync-setup#requirements/) to learn what you need to use Git Sync.

{{< /admonition >}}

**Git Sync is under development and the following limitations apply.**

**Synced resources**

- You can only sync dashboards and folders. Refer to [Supported resources](#supported-resources) for more information.
- If you're using Git Sync in Grafana OSS and Grafana Enterprise, some resources might be in an incompatible data format and won't be synced.
- Full-instance sync is not available in Grafana Cloud and has limitations in Grafana OSS and Grafana Enterprise. Refer to [Choose what to synchronize](../git-sync-setup.md#choose-what-to-synchronize) for more details.
- When migrating to full instance sync, during the synchronization process your resources will be temporarily unavailable. No one will be able to create, edit, or delete resources during this process.
- If you want to manage existing resources with Git Sync, you need to save them as JSON files and commit them to the synced repository. Open a PR to import, copy, move, or save a dashboard.
- Restoring resources from the UI is currently not possible. As an alternative, you can restore dashboards directly in your GitHub repository by raising a PR, and they will be updated in Grafana.

**Authentication**

- You can only authenticate in GitHub using your Personal Access Token token.

**Permission management**

- You cannot modify the permissions of a provisioned folder after you've synced it. 
  - Default permissions are: Admin = Admin, Editor = Editor, and Viewer = Viewer. Refer to [Roles and permissions](ref:roles-and-permissions) for more information.
- To change a default permission, update the metadata file in the repository and wait for Git Sync to synchronize it, or use the Grafana UI to save a new folders permissions drawer and commit it to the repository.

**Compatibility**

- Support for native Git, Git app, and other providers, such as GitLab or Bitbucket, is on the roadmap.

## Supported resources

Git Sync only supports dashboards and folders. Alerts, panels, and other resources are not supported yet.

If you're using Git Sync in Grafana OSS or Grafana Enterprise, some supported resources might be in an incompatible data format. If this happens, syncing will be blocked. Compatibility issues will be fixed with an upcoming migration tool.

### Resource states

A resource can be:

| Is the resource? | **Compatible**                                                             | **Incompatible**                                                                                |
| ---------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Supported**    | The resource can be managed with Git Sync.                                 | The resource is supported but has compatibility issues. It **cannot** be managed with Git Sync. |
| **Unsupported**  | The resource is **not** supported and **cannot** be managed with Git Sync. | Not applicable.                                                                                 |

### Git Sync instance states

An instance can be in one of the following Git Sync states:

- **Unprovisioned**: None of the instance's resources are being managed by Git Sync.
- **Partially provisioned**: Some of the resources are controlled by Git Sync.
- **Fully provisioned**: All supported resource types are managed by Git Sync. Note that unsupported resources are not managed.

## Common use cases

You can use Git Sync in the following scenarios.

### Version control and auditing

Organizations can maintain a structured, version-controlled history of Grafana dashboards. The version control lets you revert to previous versions when necessary, compare modifications across commits, and ensure transparency in dashboard management.

Additionally, having a detailed history of changes enhances compliance efforts, as teams can generate audit logs that document who made changes, when they were made, and why.

### Automated deployment and CI/CD integration

Teams can streamline their workflow by integrating dashboard updates into their CI/CD pipelines. By pushing changes to GitHub, automated processes can trigger validation checks, test dashboard configurations, and deploy updates programmatically using the `grafanactl` CLI and Foundation SDK.

This reduces the risk of human errors, ensures consistency across environments, and enables a faster, more reliable release cycle for dashboards used in production monitoring and analytics.

### Collaborative dashboard development

With Git Sync, multiple users can work on dashboards simultaneously without overwriting each other’s modifications.
By leveraging pull requests and branch-based workflows, teams can submit changes for review before merging them into the main branch. This process not only improves quality control but also ensures that dashboards adhere to best practices and organizational standards.

Additionally, GitHub’s built-in discussion and review tools facilitate effective collaboration, making it easier to address feedback before changes go live.

### Multi-environment synchronization

Enterprises managing multiple Grafana instances, such as development, staging, and production environments, can seamlessly sync dashboards across these instances. This ensures consistency in visualization and monitoring configurations, reducing discrepancies that might arise from manually managing dashboards in different environments.

By using Git Sync, teams can automate deployments across environments, eliminating repetitive setup tasks and maintaining a standardized monitoring infrastructure across the organization.

### Disaster recovery and backup

By continuously syncing dashboards to GitHub, organizations can create an always-updated backup, ensuring dashboards are never lost due to accidental deletion or system failures.

If an issue arises, such as a corrupted dashboard, unintended modification, or a system crash, teams can quickly restore the latest functional version from the Git repository. This not only minimizes downtime but also adds a layer of resilience to Grafana monitoring setups, ensuring critical dashboards remain available when needed.

## Provision dashboards as code

Because dashboards are defined in JSON files, you can enable as-code workflows where the JSON file is an output from Go, TypeScript, or another coding language in the format of a dashboard schema.

To learn more about creating dashboards in a coding language to provision them for Git Sync, refer to the [Foundation SDK](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/foundation-sdk) documentation.
