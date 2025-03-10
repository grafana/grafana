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

The Grafana Cloud Migration Assistant is available in Grafana 11.2+ as a [public preview feature](https://grafana.com/docs/release-life-cycle/#public-preview) that automatically migrates resources from your Grafana OSS/Enterprise instance to Grafana Cloud. It provides the following functionalities:

- Securely connect your self-managed instance to a Grafana Cloud instance.
- Seamlessly migrate resources such as dashboards, data sources, and folders to your cloud instance in a few easy steps.
- View the migration status of your resources in real-time.

Some of the benefits of the migration assistant are:

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

- Grafana v11.2 or above with the `onPremToCloudMigrations` feature toggle enabled. In Grafana 11.5, this is enabled by default. For more information on how to enable a feature toggle, refer to [Configure feature toggles](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/#configure-feature-toggles).
- A [Grafana Cloud Stack](https://grafana.com/docs/grafana-cloud/get-started/) you intend to migrate your resources to.
- [`Admin`](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/cloud-roles/) access to the Grafana Cloud Stack. To check your access level, go to `https://grafana.com/orgs/<YOUR-ORG-NAME>/members`.
- [Grafana server administrator](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/#grafana-server-administrators) access to your existing Grafana OSS/Enterprise instance. To check your access level, go to `https://<GRAFANA-ONPREM-URL>/admin/users`.
- Internet access from your existing Grafana OSS/Enterprise instance.

## Access the migration assistant

In Grafana OSS, access to the migration assistant is limited to the server administrator.

In Grafana Enterprise, the server administrator has access to the migration assistant by default. It is also possible to grant access to other Admins using a role-based access control (RBAC) role that enables other admins on the Grafana instance to view, build snapshots, and upload resources to Grafana Cloud.

### Grant access in Grafana Enterprise

{{< admonition type="important">}}
You must [configure RBAC](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/configure-rbac/) before you can grant other administrators access to the Grafana Migration Assistant.
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

### Generate a migration token on the destination cloud instance:

1. Navigate to **Home** > **Administration** > **General** > **Migrate to Grafana Cloud** in the cloud instance where you intend to migrate your resources.
1. Click on the **Generate a migration token** button.

   ![The Generate a migration token button in the Migrate to Grafana Cloud page in the intended Grafana Cloud Stack](/media/docs/grafana-cloud/account-management/screenshot-generate-migration-token.png)

1. Make a copy of the migration token by copying to clipboard. The token is required to authenticate your self-managed instance with the Grafana Cloud Stack.

### Connect your self-managed Grafana instance to the Grafana Cloud Stack

1. On your self-managed Grafana instance, navigate to **Home** > **Administration** > **General** > **Migrate to Grafana Cloud**.

1. Click the **Migrate this instance to Cloud** button.

   ![The Migrate this instance to Cloud button in the Migrate to Grafana Cloud page on a self-managed Grafana instance](/media/docs/grafana-cloud/account-management/screenshot-migrate-to-cloud.png)

1. Enter your token and click **Connect to this Stack**.

   ![The Migration token field and Connect to this stack button in the Connect to a cloud stack page in a self-managed Grafana instance](/media/docs/grafana-cloud/account-management/screenshot-connect-to-a-stack.png)

### Build a snapshot

After connecting to the cloud stack, this is the empty state of the migration assistant. You need to create a snapshot of the self-managed Grafana instance to upload it to the cloud stack.

- Click **Build snapshot**

  ![The Build snapshot button on the Migrate to Grafana Cloud page in a self-managed Grafana instance](/media/docs/grafana-cloud/account-management/screenshot-build-a-snapshot.png)

### Upload resources to the cloud

After a snapshot is created, a list of resources appears with resource Type and Status populated with **Not yet uploaded**.

![A list of resources with snapshots built but not yet uploaded to Grafana Cloud](/media/docs/grafana-cloud/account-management/screenshot-upload-snapshot.png)

1. Click on **Upload snapshot** to copy the resources to the Grafana Cloud instance. This also updates statuses for the list of resources. The status changes to 'Uploaded to cloud' for resources successfully copied to the cloud.

   The Snapshot information also updates to inform the user of total resources, errors, and total number of successfully migrated resources.

   ![An updates list of resources with snapshots built after attempting to upload them to Grafana Cloud](/media/docs/grafana-cloud/account-management/screenshot-updated-snapshot-page.png)

1. Use the assistant's real-time progress tracking to monitor the migration.

1. Review error details for any issues that need manual resolution.

## Snapshots created by the migration assistant

The migration assistant currently supports a subset of all resources available in Grafana. Refer to [Supported Resources](https://wwww.grafana.com/docs/grafana-cloud/account-management/cloud-migration-assistant/#supported-resources) for more details.

When you create a snapshot, the migration assistant makes a copy of all supported resources and saves them in the snapshot. The snapshot reflects the current state of the resources when the snapshot is built and is stored locally on your instance, ready to be uploaded in the last stage. It is currently not possible to select specific resources to include in the snapshot, such as only dashboards. All supported resources are included by default.

Resources saved in the snapshot are strictly limited to the resources stored within an organization. This is important to note if there are multiple organizations used in your Grafana instance. If you want to migrate multiple organizations, refer to [Migrate multiple organizations](https://wwww.grafana.com/docs/grafana-cloud/account-management/cloud-migration-assistant/#migrate-multiple-organizations) for more information and guidance.

## Resource migration details

During a migration, resource UIDs are preserved, allowing you to correlate your local and cloud resources. If you perform the same migration multiple times, resources in your Grafana Cloud stack that were previously migrated are updated. The assistant never modifies your self-managed resources or cloud resources that didn't come from a snapshot.

### Dashboards and folders

Dashboard names and UIDs are preserved along with references to data sources. Folder hierarchy is also preserved, so you can find your dashboards and other resources saved in identical folder locations.

### Data sources

Your data sources, including credentials, are migrated securely and seamlessly to your Grafana Cloud instance, so you don't need to find and enter all your data source credentials again.

### Plugins

The migration assistant supports any plugins found in the plugins catalog. As long as the plugin is signed or is a core plugin built into Grafana, it is eligible for migration. Due to security reasons, unsigned plugins are not supported in Grafana Cloud. If you are using any unsigned private plugins, Grafana recommends you seek an alternative plugin for the catalog or work on a strategy to deprecate certain functionality from your self-managed instance.

### Grafana Alerting resources

The migration assistant can migrate the majority of Grafana Alerting resources to your Grafana Cloud instance. These include:

- Alert rules
- Notifications
- Contact points
- Mute timings
- Notification policy tree
- Notification templates

This is sufficient to have your Alerting configuration up and running in Grafana Cloud with minimal effort.

Migration of Silences is not supported by the migration assistant and needs to be configured manually. Alert History is also not available for migration.

Successfully migrating Alerting resources to your Grafana Cloud instance could result in 2 sets of notifications being generated; one from your OSS/Enterprise instance and another from the newly migrated alerts in your Grafana Cloud instance. To avoid double notifications, a new `alert_rules_state` configuration option in the `custom.ini` or `grafana.ini` file controls how Alert Rules are migrated to the Grafana Cloud instance and is set to `paused` by default so you can review and test your Alerting resources in your Grafana Cloud instance without duplicate notifications.

The available options for `alert_rule_state` are:

`paused`
: Creates all Alert rules in paused state on the Cloud instance. This is helpful to avoid double notifications.

`unchanged`
: The Alert rules maintain their original state coming from the source instance.

When you are ready to start using your alert rules and notifications from your Grafana Cloud instance, run the migration again with `alert_rules_state = unchanged`.

### Resource permissions

Because the migration assistant does not yet migrate teams or RBAC permissions, your resources are migrated with default permissions. Ensure that you reconfigure permissions in your cloud stack as needed following a migration. For more information, refer to [Grafana Cloud user roles and permissions](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/cloud-roles/).

## Migrate multiple organizations

If you are using the [organizations](https://grafana.com/docs/grafana/latest/administration/organization-management/#about-organizations) feature on your Grafana Instance and intend to migrate to Grafana Cloud, you need to plan this aspect of the migration carefully.

The organizations feature is not supported in Grafana Cloud, but folders and RBAC can be used to protect and grant permissions to resources instead. The recommended path is to migrate multiple organizations to a single cloud stack. This is the simplest option and provides the best user experience.

The migration assistant creates and uploads snapshots based on the resources within a specific organization. There is no option to migrate an entire Grafana instance with multiple organizations at once. You need to run the migration process for each organization you want to migrate.

The Grafana server administrator is granted access to the migration assistant by default. The server administrator can perform the migration by switching organizations and running the migration assistant each time. The Grafana server administrator can also grant access to the migration assistant to organization administrators who are members using the RBAC **Migration Assistant:Organization resource migrator** role. This allows those organization administrators to run the migration process for their respective organizations.

### Access Control and managing resources in the Cloud Instance

The main driver for setting up organizations in the first place is resource isolation. In order to achieve this in Grafana Cloud, you can organize resources into folders and set up teams and permissions that correspond to your organizations.

For more information about configuring teams and permissions, refer to [Configure Grafana Teams](https://grafana.com/docs/grafana/latest/administration/team-management/configure-grafana-teams/).
