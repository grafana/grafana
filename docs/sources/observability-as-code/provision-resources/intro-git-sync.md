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

# Introduction to Git Sync

{{< admonition type="caution" >}}

TBC

{{< /admonition >}}

Using Git Sync, you can:

- Introduce a review process for creating and modifying dashboards
- Manage dashboard configuration outside of Grafana instances
- Replicate dashboards across multiple instances

## How it works

Because dashboards are defined in JSON files, you can enable as-code workflows where the JSON is an utput from Go, TypeScript, or another coding language in the format of a dashboard schema. To learn more about creating dashboards in a coding language to provision them for Git Sync, refer to the [Foundation SDK](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/foundation-sdk) documentation.

Git Sync is bidirectional and also works with changes done directly in GitHub as well as within the Grafana UI.

### Making changes in Grafana 

Whenever you modify a dashboard, Grafana can commit changes to Git upon saving: 

- You can configure settings to either enforce PR approvals before merging or allow direct commits.
- Grafana periodically polls GitHub at a regular internal to synchronize any changes.
    - With the webhooks feature enabled, repository notifications appear almost immediately.
    - Without webhooks, Grafana polls for changes at the specified interval.
- The default polling interval is 60 seconds.

### Making changes in your GitHub repositories

With Git Sync, you can make changes in your provisioned files in GitHub and see them in Grafana: 

- Automated workflows ensure those changes are automatically represented in the Grafana database by updating Git.
- The Grafana UI reads the database and updates the UI to reflect these changes.

## Known limitations

Git Sync is under development and the following limitations apply:

- You can only authenticate using your GitHub token.
- Support for native Git and other providers, such as GitLab or Bitbucket, is scheduled.
- If you're using Git Sync in Grafana Cloud you can only sync specific folders for the moment. Git Sync will be available for your full instance soon. 
- Restoring resources from the UI is currently not possible. As an alternative, you can restore dashboards directly in your GitHub repository by raising a PR, and they will be updated in Grafana.  

## Common use cases

Git Sync in Grafana lets you manage your dashboards as code as JSON files stored in GitHub. You and your team can version control, collaborate, and automate deployments efficiently.

### Version control and auditing

Organizations can maintain a structured, version-controlled history of Grafana dashboards. The version control lets you revert to previous versions when necessary, compare modifications across commits, and ensure transparency in dashboard management.

Additionally, having a detailed history of changes enhances compliance efforts, as teams can generate audit logs that document who made changes, when they were made, and why.

### Automated deployment and CI/CD integration

Teams can streamline their workflow by integrating dashboard updates into their CI/CD pipelines.
By pushing changes to GitHub, automated processes can trigger validation checks, test dashboard configurations, and deploy updates programmatically using the `grafanactl` CLI and Foundation SDK.
This reduces the risk of human errors, ensures consistency across environments, and enables a faster, more reliable release cycle for dashboards used in production monitoring and analytics.

### Collaborative dashboard development

With Git Sync, multiple users can work on dashboards simultaneously without overwriting each other’s modifications.
By leveraging pull requests and branch-based workflows, teams can submit changes for review before merging them into the main branch. This process not only improves quality control but also ensures that dashboards adhere to best practices and organizational standards. Additionally, GitHub’s built-in discussion and review tools facilitate effective collaboration, making it easier to address feedback before changes go live.

### Multi-environment synchronization

Enterprises managing multiple Grafana instances, such as development, staging, and production environments, can seamlessly sync dashboards across these instances. This ensures consistency in visualization and monitoring configurations, reducing discrepancies that might arise from manually managing dashboards in different environments.

By using Git Sync, teams can automate deployments across environments, eliminating repetitive setup tasks and maintaining a standardized monitoring infrastructure across the organization.

### Disaster recovery and backup

By continuously syncing dashboards to GitHub, organizations can create an always-updated backup, ensuring dashboards are never lost due to accidental deletion or system failures.

If an issue arises, such as a corrupted dashboard, unintended modification, or a system crash, teams can quickly restore the latest functional version from the Git repository.

This not only minimizes downtime but also adds a layer of resilience to Grafana monitoring setups, ensuring critical dashboards remain available when needed.
