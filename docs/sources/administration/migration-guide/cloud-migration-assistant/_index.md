---
description: Migrate from Grafana OSS/Enterprise to Grafana Cloud using the Grafana Cloud Migration Assistant
keywords:
  - Grafana Cloud
  - Grafana Enterprise
  - Grafana OSS
menuTitle: Migrate to Grafana Cloud using the Grafana Cloud Migration Assistant
title: Migrate from Grafana OSS/Enterprise to Grafana Cloud using the Grafana Cloud Migration Assistant
weight: 400
---

# Grafana Cloud Migration Assistant

The Grafana Cloud Migration Assistant automatically migrates resources from your Grafana OSS/Enterprise instance to Grafana Cloud. It provides the following functionality:

- Securely connect your self-managed instance to a Grafana Cloud instance.
- Migrate resources such as dashboards, data sources, and folders to your cloud instance in a few easy steps.
- View the migration status of your resources in real-time.

Some benefits of the migration assistant are:

Ease of use
: Follow the steps provided by the UI to easily migrate all your resources to Grafana Cloud without using Grafana APIs or scripts.

Security
: Encrypt and securely migrate your resources to your connected Grafana Cloud instance.

Speed
: Migrate all of your resources in minutes and accelerate your transition to Grafana Cloud.

## Supported resources

The following resources are supported by the migration assistant:

- Dashboards
- Folders
- Data sources
- App Plugins
- Panel Plugins
- Library Panels
- Grafana Alerting resources

## Before you begin

To use the Grafana migration assistant, you need:

- A self-managed Grafana instance.
- A [Grafana Cloud Stack](https://grafana.com/docs/grafana-cloud/get-started/) you intend to migrate your resources to.
- [`Admin`](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/cloud-roles/) access to the Grafana Cloud Stack. To check your access level, go to `https://grafana.com/orgs/<YOUR-ORG-NAME>/members`.
- [Grafana server administrator](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/#grafana-server-administrators) access to your existing self-managed Grafana instance. To check your access level, go to `https://<GRAFANA-ONPREM-URL>/admin/users`.
- Internet access from your existing self-managed Grafana instance.
- If you're running Grafana in a [highly-available setup](https://grafana.com/docs/grafana/latest/setup-grafana/set-up-for-high-availability/), we recommend scaling Grafana down to one replica to avoid a [known bug](https://github.com/grafana/grafana/issues/107264).
- If your network requires external services to be on an allowlist to allow access, add the following IPs and URLs to your allowlist:
  - [Hosted Grafana](https://grafana.com/docs/grafana-cloud/security-and-account-management/allow-list/#hosted-grafana)
  - [Hosted Alerts](https://grafana.com/docs/grafana-cloud/security-and-account-management/allow-list/#hosted-alerts)
  - [AWS IP address ranges](https://docs.aws.amazon.com/en_us/vpc/latest/userguide/aws-ip-ranges.html) for the S3 service
  - `*.grafana.net`

If you upgrade your self-managed instance to meet the minimum version requirement, resolve any dashboards or data sources broken by the upgrade before you migrate. Fixing resources on your self-managed instance first helps prevent the same errors from appearing in Grafana Cloud.

## Access the migration assistant

In Grafana OSS, access to the migration assistant is limited to the server administrator.

In Grafana Enterprise, the server administrator has access to the migration assistant by default. You can also grant access to other Admins using a role-based access control (RBAC) role that enables other admins on the Grafana instance to view, build snapshots, and upload resources to Grafana Cloud.

If you can't access **Home** > **Administration** > **General** > **Migrate to Grafana Cloud**, confirm that the `onPremToCloudMigrations` feature toggle is enabled on your self-managed instance. For more information, refer to [Configure feature toggles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/).

### Grant access in Grafana Enterprise

{{< admonition type="note" >}}
You must [configure RBAC](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/configure-rbac/) before you can grant other administrators access to the Grafana Migration Assistant.
{{< /admonition >}}

To grant other Admins access to the migration assistant in Grafana Enterprise:

1. Sign in to Grafana as a server administrator.
1. Navigate to **Home** > **Administration** > **Users and access** > **Users** in the Grafana sidebar.
1. Click an Admin.
1. In the **Organizations** section, click **Change role**.
1. Select **Organization resource migrator** from the role selector menu under **Migration Assistant**.

   ![The Organization resource migrator role in the role picker](/media/docs/grafana-cloud/account-management/screenshot-grant-migration-assistant-access.png)

1. Click **Apply**.

## Use the migration assistant

You can use the migration assistant to generate a migration token on your Grafana Cloud instance, use that token to connect your self-managed Grafana instance to your Grafana Cloud instance, build snapshots of your self-managed Grafana instance, and upload these snapshots to Grafana Cloud.

### Generate a migration token on the destination cloud instance

1. Navigate to **Home** > **Administration** > **General** > **Migrate to Grafana Cloud** in the cloud instance where you intend to migrate your resources.
1. Click the **Generate a migration token** button.
1. Make a copy of the migration token by copying to clipboard. The token is required to authenticate your self-managed instance with the Grafana Cloud Stack.

### Connect your self-managed Grafana instance to the Grafana Cloud Stack

1. On your self-managed Grafana instance, navigate to **Home** > **Administration** > **General** > **Migrate to Grafana Cloud**.

1. Click the **Migrate this instance to Cloud** button.

1. Enter your token in the **Migration token** field and click **Connect to this Stack**.

### Build a snapshot

After connecting to the cloud stack, this is the empty state of the migration assistant. You need to create a snapshot of the self-managed Grafana instance to upload it to the cloud stack.

1. Select the checkbox next to each resource you want to migrate to your cloud stack.

   {{< admonition type="note" >}}
   Some resources can't be uploaded to your cloud stack alone because they rely on other resources:
   | Desired resource | Requires |
   | :---- | :---- |
   | Dashboards | <ul><li>Library Elements</li> <li>Data Sources</li> <li>Plugins</li> <li>Folders</li></ul> |
   | Library Elements | Folders |
   | Data Sources | Plugins |
   | Plugins | Nothing else |
   | Folders | Nothing else |
   | All Alert rule groups | All other resources |
   | Alert Rules | <ul><li>Dashboards</li> <li>Library Elements</li> <li>Data Sources</li> <li>Plugins</li> <li>Folders</li> <li>Notification Policies</li> <li>Notification Templates</li> <li>Contact Points</li> <li>Mute Timings</li></ul> |
   | Notification Policies | <ul><li>Notification Templates</li> <li>Contact Points</li> <li>Mute Timings</li></ul> |
   | Notification Templates | Nothing else |
   | Contact Points | Notification Templates |
   | Mute Timings | Nothing else |
   {{< /admonition >}}

1. Click **Build snapshot**

   ![A list of resources selected for migration and the Build snapshot button](/media/docs/grafana/screenshot-grafana-12-select-resources.png)

### Upload resources to the cloud

After a snapshot is created, a list of resources appears with resource Type and Status populated with **Not yet uploaded**.

1. Click **Upload snapshot** to copy the resources to the Grafana Cloud instance.

1. Use the assistant's real-time progress tracking to monitor the migration. The status changes to 'Uploaded to cloud' for resources successfully copied to the cloud.

   You can group and sort resources during and after the migration:
   - Click **Name** to sort resources alphabetically.
   - Click **Type** to group and sort by resource type.
   - Click **Status** to group and sort by upload status (pending upload, uploaded successfully, or experienced errors).

   The Snapshot information also updates to inform the user of total resources, errors, and total number of successfully migrated resources.

   ![An updates list of resources with snapshots built after attempting to upload them to Grafana Cloud](/media/docs/grafana/screenshot-grafana-12-updated-snapshot-page.png)

1. Review error details for any issues that need manual resolution.

## Validate your migration

After you upload a snapshot, use the migration assistant UI to verify that your resources were copied successfully.

The snapshot information panel shows:

- **Total resources**: The number of resources contained in the snapshot.
- **Errors**: The number of errors that occurred while copying resources to Grafana Cloud.
- **Successfully migrated**: The number of resources successfully copied to Grafana Cloud.
- **Uploading to**: The slug of the destination Grafana Cloud stack.

The resource list shows each resource's name, type, and upload status. Use the **Status** column to confirm whether individual resources were copied successfully or require attention.

## Snapshots and upload performance

The migration assistant currently supports a subset of all resources available in Grafana. Refer to [Supported resources](#supported-resources) for more details.

When you create a snapshot, the migration assistant makes a copy of all the resources you select and saves them in the snapshot. The snapshot reflects the current state of the resources when the snapshot is built and is stored locally on your instance, ready to be uploaded in the last stage. Snapshots are encrypted on the filesystem of your self-managed instance. The migration assistant transfers the snapshot to the Grafana Labs cloud infrastructure and decrypts the data for processing.

Resources saved in the snapshot are strictly limited to the resources stored within an organization. This is important to note if there are multiple organizations used in your Grafana instance. If you want to migrate multiple organizations, refer to [Migrate multiple organizations](#migrate-multiple-organizations).

Upload time depends primarily on the volume of data you're migrating with most migration operations running asynchronously, so you aren't blocked while a migration is pending and you can perform other tasks on your self-managed instance.

## Rollback and recovery procedures

If issues occur during or after a migration, the following recovery and rollback constraints apply.

### No automated rollback

No tool exists to automatically undo or roll back a migration. If you need to start fresh, you must manually delete the migrated dashboards, folders, and data sources from your Grafana Cloud instance. On a typical migration path, you migrate to a new Grafana Cloud stack that doesn't contain existing resources.

### Snapshot limitations

While the tool takes a snapshot, its utility for recovery is limited:

- **Single snapshot only**: Only the latest snapshot is available; the system doesn't maintain a history of previous snapshots.
- **One snapshot at a time**: At most one snapshot exists on your self-managed instance at any given time.

### Handling errors and partial migrations

If a migration results in errors, resolve the issues on your self-managed instance, take a new snapshot, and upload it again. Resources on your Grafana Cloud instance are overwritten by the latest snapshot data.

The migration process is non-destructive to the source. Resources on your self-managed instance aren't modified, which serves as an inherent safety measure.

## Disaster recovery and resilience

The Grafana Migration Service (GMS) is designed to recover gracefully from failures during migration.

Resilience to crashes
: GMS uses AWS SQS to distribute work and creates snapshot checkpoints in DynamoDB, allowing it to efficiently pick up where it left off if a crash occurs during a migration.

High availability
: The service runs multiple replicas and depends on highly available AWS services to minimize the likelihood of downtime.

## Resource migration details

During a migration, resource UIDs are preserved, allowing you to correlate your local and cloud resources. If you perform the same migration multiple times, resources in your Grafana Cloud stack that were previously migrated are updated. The assistant never modifies your self-managed resources or cloud resources that didn't come from a snapshot.

### Dashboards and folders

Dashboard names and UIDs are preserved along with references to data sources. Folder hierarchy is also preserved, so you can find your dashboards and other resources saved in identical folder locations.

### Data sources

Your data sources, including credentials, are migrated securely and seamlessly to your Grafana Cloud instance, so you don't need to find and enter all your data source credentials again.

Resolve any data source configuration errors on your self-managed instance before you migrate. This helps ensure error-free data sources appear in Grafana Cloud.

If your dashboards use data sources on a private network that aren't accessible over the public internet, configure [Private data source connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) after migration. PDC lets Grafana Cloud query data sources in your private network without opening inbound access. Confirm that your data source type supports PDC, and configure each applicable data source to connect through PDC after completing the migration.

### Plugins

The migration assistant supports any plugins found in the plugins catalog. As long as the plugin is signed or is a core plugin built into Grafana, you can migrate it. Due to security reasons, Grafana Cloud doesn't support unsigned plugins. If you're using any unsigned private plugins, seek an alternative plugin from the catalog or work on a strategy to deprecate certain functionality from your self-managed instance.

You can only install plugins available in the [Grafana plugins catalog](https://grafana.com/grafana/plugins/) on Grafana Cloud. The migration assistant doesn't support private, custom-built, or third-party plugins that require manual uploading or modifications to Grafana backend files.

If a plugin doesn't appear in the resource list on the **Migrate to Grafana Cloud** page, it isn't supported by the migration assistant and you must install it manually on your Grafana Cloud instance.

Upgrade any plugins you intend to migrate before using the migration assistant as any migrated plugins will be configured on the Grafana Cloud instance as the latest version of that plugin.

{{< admonition type="caution">}}
If you want to migrate Enterprise plugins, check what type of plan your Grafana Cloud instance is on and whether this plan requires an Enterprise plugin add-on.
{{< /admonition >}}

### Grafana Alerting resources

The migration assistant can migrate the majority of Grafana Alerting resources to your Grafana Cloud instance. These include:

- Alert rules
- Notifications
- Contact points
- Mute timings
- Notification policy tree
- Notification templates

This is sufficient to have your Alerting configuration up and running in Grafana Cloud with minimal effort.

#### Migration assistant limitations on Grafana Alerting resources

The migration assistant doesn't support migration of Silences, so you need to configure them manually. Alert History also isn't available for migration.

Attempting to migrate a large number of alert rules might result in the following error:

```
Maximum number of alert rule groups reached: Delete some alert rule groups or upgrade your plan and try again.
```

To avoid this, refer to the [Alert rule limits in Grafana Cloud](https://grafana.com/docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-grafana-managed-rule/#alert-rule-limits-in-grafana-cloud) when migrating alert rules.

#### Prevent duplicated alert notifications

Successfully migrating Alerting resources to your Grafana Cloud instance can result in two sets of notifications:

1. From your OSS/Enterprise instance

1. From the newly migrated alerts in your Grafana Cloud instance

To avoid double notifications, a new `alert_rules_state` configuration option in the `custom.ini` or `grafana.ini` file controls how Alert Rules are migrated to the Grafana Cloud instance and is set to `paused` by default so you can review and test your Alerting resources in your Grafana Cloud instance without duplicate notifications.

The available options for `alert_rule_state` are:

`paused`
: Creates all Alert rules in paused state on the Cloud instance. This is helpful to avoid double notifications.

`unchanged`
: The Alert rules maintain their original state coming from the source instance.

When you are ready to start using your alert rules and notifications from your Grafana Cloud instance, run the migration again with `alert_rules_state = unchanged`.

### Resource permissions

Because the migration assistant doesn't yet migrate teams or RBAC permissions, your resources migrate with default permissions. Reconfigure permissions in your cloud stack as needed after a migration. The migration assistant also doesn't migrate users. For more information, refer to [Grafana Cloud user roles and permissions](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/cloud-roles/).

## Multi-environment migration strategy

If you operate separate self-managed instances for development, staging, and production, plan your Grafana Cloud stack layout before you migrate.

- **Production**: We recommend a single Grafana Cloud stack for production. For guidance on structuring users and data, refer to [Structuring users and data in Grafana Cloud](https://grafana.com/docs/grafana-cloud/account-management/organize-your-stack/).
- **Development and staging**: Separate Grafana Cloud stacks for development and staging environments are acceptable. Consider whether you need dedicated development and staging stacks before you create them.

To migrate each environment:

1. Create a Grafana Cloud stack for each environment you want to migrate.
1. Upgrade each self-managed instance to Grafana 11.2 or later.
1. Generate a migration token on each target cloud stack.
1. Connect each self-managed instance to its corresponding cloud stack using the correct migration token.

The migration assistant doesn't synchronize configurations between environments. Each upload copies resources in one direction only, from your self-managed instance to Grafana Cloud. Re-uploading a snapshot overwrites previously migrated resources on the target cloud stack.

## Migrate multiple organizations

If you're using the [organizations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/organization-management/#about-organizations) feature on your Grafana Instance and intend to migrate to Grafana Cloud, you need to plan this aspect of the migration carefully.

Grafana Cloud doesn't support the organizations feature, but you can use folders and RBAC to protect and grant permissions to resources instead. The recommended path is to migrate multiple organizations to a single cloud stack. This is the simplest option and provides the best user experience.

The migration assistant creates and uploads snapshots based on the resources within a specific organization. There's no option to migrate an entire Grafana instance with multiple organizations at once. You need to run the migration process for each organization you want to migrate.

The Grafana server administrator has access to the migration assistant by default. The server administrator can perform the migration by switching organizations and running the migration assistant each time. The Grafana server administrator can also grant access to the migration assistant to organization administrators who are members using the RBAC **Migration Assistant:Organization resource migrator** role. This allows those organization administrators to run the migration process for their respective organizations.

### Access Control and managing resources in the Cloud Instance

The main driver for setting up organizations in the first place is resource isolation. In order to achieve this in Grafana Cloud, you can organize resources into folders and set up teams and permissions that correspond to your organizations.

For more information about configuring teams and permissions, refer to [Configure Grafana Teams](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/team-management/configure-grafana-teams/).

## Troubleshoot migration assistant issues

For solutions to common migration issues, refer to [Troubleshoot migration assistant issues](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/migration-guide/cloud-migration-assistant/troubleshooting/).
