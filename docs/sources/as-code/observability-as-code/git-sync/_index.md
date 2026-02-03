---
description: Learn about Git Sync, the Grafana feature for storing and managing dashboards within GitHub repositories.
keywords:
  - dashboards
  - git integration
  - git sync
  - github
  - observability
  - configuration
  - as code
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
title: Introduction to Git Sync
menuTitle: Git Sync
weight: 300
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/
aliases:
  - ../../../observability-as-code/provision-resources/intro-git-sync/
  - ./provision-resources/intro-git-sync/
---

# Introduction to Git Sync

{{< admonition type="caution" >}}

Git Sync is available in [public preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud, and is an [experimental feature](https://grafana.com/docs/release-life-cycle/) in Grafana v12 for open source and Enterprise editions. Documentation and support is available **based on the different tiers** but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

**Git Sync is under development.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) for more information. [Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

Git Sync in Grafana lets you synchronize your resources so you can store your dashboards as JSON files stored in GitHub and manage them as code. You and your team can version control, collaborate, and automate deployments efficiently.

## How it works

Git Sync allows you to connect external resources with your Grafana instance. After setup, all synchronized resources live under the `provisioned` folder. You can continue to have unprovisioned resources outside that folder.

Git Sync is bidirectional. You can modify provisioned resources both from the Grafana UI or from the synced repository, and changes will be reflected in both places.

Refer to [key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts) and [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) for further details.

### Make changes in the Grafana UI

Whenever you modify a dashboard directly from the UI, you can also commit those changes to Git upon saving. You can configure settings to either enforce PR approvals before merging in your repository, or allow direct commits.

### Make changes in your GitHub repositories

Your Grafana instance polls the provisioned GitHub resources to synchronize. If you made any changes in GitHub, they will be updated in the Grafana database as well. The Grafana UI reads from the database and updates the UI to reflect these changes.

- Without webhooks, Grafana polls for changes at the specified interval. The default polling interval is 60 seconds, and you can change this setting in the Grafana UI.
- If you enable the [webhooks feature](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/#configure-webhooks-and-image-rendering), repository notifications appear almost immediately.

## Resource support and compatibility

Git Sync only supports dashboards and folders. Alerts, panels, and other resources are not supported yet.

If you're using Git Sync in Grafana OSS or Grafana Enterprise, some supported resources might be in an incompatible data format. If this happens, syncing will be blocked. Compatibility issues will be fixed with an upcoming migration tool.

A resource can be:

| Is the resource? | **Compatible**                                                             | **Incompatible**                                                                                |
| ---------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Supported**    | The resource can be managed with Git Sync.                                 | The resource is supported but has compatibility issues. It **cannot** be managed with Git Sync. |
| **Unsupported**  | The resource is **not** supported and **cannot** be managed with Git Sync. | Not applicable.                                                                                 |

## Common use cases

{{< admonition type="note" >}}

Refer to [Git Sync deployment scenarios](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/git-sync-deployment-scenarios) for sample scenarios, including architecture and configuration details.

{{< /admonition >}}

You can use Git Sync for the following use cases:

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

## Build dashboards as code

Because dashboards are defined in JSON files, you can enable as-code workflows where the JSON file is an output from Go, TypeScript, or another coding language in the format of a dashboard schema.

To learn more about creating dashboards in a coding language to provision them for Git Sync, refer to the [Foundation SDK](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/foundation-sdk) documentation.

## Explore Git Sync

{{< section withDescriptions="true" depth="5" >}}
