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
title: Git Sync
weight: 100
---

# Git Sync

{{< admonition type="caution" >}}
Git Sync is an [experimental feature](https://grafana.com/docs/release-life-cycle/) introduced in Grafana v12 for open source and Enterprise editions. Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided. Enable the `provisioning` and `kubernetesDashboards` feature toggles in Grafana to use this feature. Git Sync isn't available in Grafana Cloud.
{{< /admonition >}}

Using Git Sync, you can:

- Introduce a review process for creating and modifying dashboards
- Manage dashboard configuration outside of Grafana instances
- Replicate dashboards across multiple instances

Whenever a dashboard is modified, Grafana can commit changes to Git upon saving. Users can configure settings to either enforce PR approvals before merging or allow direct commits.

Users can push changes directly to GitHub and see them in Grafana. Similarly, automated workflows can do changes that will be automatically represented in Grafana by updating Git.

Because the dashboards are defined in JSON files, you can enable as-code workflows where the JSON is output from Go, TypeScript, or another coding language in the format of a dashboard schema.

To learn more about creating dashboards in a coding language to provision them for Git Sync, refer to the [Foundation SDK](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/foundation-sdk) documentation.

## How it works

Git Sync is bidirectional and also works with changes done directly in GitHub as well as within the Grafana UI.
Grafana periodically polls GitHub at a regular internal to synchronize any changes.
With the webhooks feature enabled, repository notifications appear almost immediately.
Without webhooks, Grafana polls for changes at the specified interval.
The default polling interval is 60 seconds.

Any changes made in the provisioned files stored in the GitHub repository are reflected in the Grafana database.
The Grafana UI reads the database and updates the UI to reflect these changes.

## Common use cases

Git Sync in Grafana lets you manage dashboards as code.
Because your dashboard JSON files are stored in GitHub, you and your team can version control, collaborate, and automate deployments efficiently.

### Version control and auditing

Organizations can maintain a structured, version-controlled history of Grafana dashboards.
The version control lets you revert to previous versions when necessary, compare modifications across commits, and ensure transparency in dashboard management.
Additionally, having a detailed history of changes enhances compliance efforts, as teams can generate audit logs that document who made changes, when they were made, and why.

### Automated deployment and CI/CD integration

Teams can streamline their workflow by integrating dashboard updates into their CI/CD pipelines.
By pushing changes to GitHub, automated processes can trigger validation checks, test dashboard configurations, and deploy updates programmatically using the `grafanactl` CLI and Foundation SDK.
This reduces the risk of human errors, ensures consistency across environments, and enables a faster, more reliable release cycle for dashboards used in production monitoring and analytics.

### Collaborative dashboard development

With Git Sync, multiple users can work on dashboards simultaneously without overwriting each other’s modifications.
By leveraging pull requests and branch-based workflows, teams can submit changes for review before merging them into the main branch. This process not only improves quality control but also ensures that dashboards adhere to best practices and organizational standards. Additionally, GitHub’s built-in discussion and review tools facilitate effective collaboration, making it easier to address feedback before changes go live.

### Multi-environment synchronization

Enterprises managing multiple Grafana instances, such as development, staging, and production environments, can seamlessly sync dashboards across these instances.
This ensures consistency in visualization and monitoring configurations, reducing discrepancies that might arise from manually managing dashboards in different environments.
By using Git Sync, teams can automate deployments across environments, eliminating repetitive setup tasks and maintaining a standardized monitoring infrastructure across the organization.

### Disaster recovery and backup

By continuously syncing dashboards to GitHub, organizations can create an always-updated backup, ensuring dashboards are never lost due to accidental deletion or system failures.
If an issue arises--such as a corrupted dashboard, unintended modification, or a system crash--teams can quickly restore the latest functional version from the Git repository.
This not only minimizes downtime but also adds a layer of resilience to Grafana monitoring setups, ensuring critical dashboards remain available when needed.
