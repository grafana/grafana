---
description: Troubleshoot common issues when using the Grafana Cloud Migration Assistant.
keywords:
  - Grafana Cloud
  - migration assistant
  - troubleshooting
menuTitle: Troubleshooting
title: Troubleshoot migration assistant issues
weight: 100
---

# Troubleshoot migration assistant issues

The following sections describe common migration issues and steps to resolve them.

## Cannot access the migration assistant

If you can't navigate to **Home** > **Administration** > **General** > **Migrate to Grafana Cloud**, confirm the following:

1. You're signed in as a Grafana server administrator on your self-managed instance.
1. Your self-managed instance runs Grafana 11.2 or later.
1. The `onPremToCloudMigrations` feature toggle is enabled. For more information, refer to [Configure feature toggles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/).

## Cannot connect to a cloud stack

If you receive an **Error saving token** message when connecting your self-managed instance to Grafana Cloud, check the following:

1. **Migration token**: Confirm that the migration token exists on your Grafana Cloud stack and that you copied it correctly. The token is only shown once when you first generate it. If you no longer have a copy, generate a new token on your cloud stack.
1. **Network connectivity**: Confirm that your self-managed instance can access the internet and that firewall or network rules allow connections to Grafana Cloud. Refer to the allowlist requirements in [Before you begin](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/migration-guide/cloud-migration-assistant/#before-you-begin).

If the issue persists, check your self-managed instance logs for messages such as `token could not be decoded` or HTTP 500 responses on `/api/cloudmigration/migration`.

## Cannot create a snapshot

If you receive an **Error creating snapshot** message, the migration token on your self-managed instance likely no longer matches the token on your Grafana Cloud stack. This can happen if the token was deleted or regenerated on the cloud stack after you connected.

To resolve this:

1. Confirm that a migration token exists on your Grafana Cloud stack. If a token already exists but was regenerated, delete the existing token on the cloud stack.
1. Generate a new migration token on your Grafana Cloud stack and copy it to your clipboard.
1. On your self-managed instance, disconnect from the cloud stack.
1. Click **Migrate this instance to Cloud**, enter the new migration token, and click **Connect to this Stack**.
1. Create a new snapshot.

Your self-managed instance logs may show `authentication error: invalid token` or HTTP 401 responses from the Grafana Migration Service.

## Data source not working after migration

If migrated dashboards show panel errors in Grafana Cloud but worked on your self-managed instance, check the following:

1. **Data source connectivity**: Confirm whether the error is a data source connection issue. Data sources on private networks aren't accessible over the public internet from Grafana Cloud.
1. **Private data source connect (PDC)**: If the data source runs on a private network, confirm that the data source type supports PDC and [configure PDC](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/) in your network.
1. **Migration errors**: Review the resource status in the migration assistant to confirm the data source was copied without errors.

## Plugins not migrated

If plugins are missing from your Grafana Cloud instance or don't appear in the resource list on the **Migrate to Grafana Cloud** page, the migration assistant doesn't support those plugins. You can only migrate plugins available in the [Grafana plugins catalog](https://grafana.com/grafana/plugins/). Install unsupported plugins manually on your Grafana Cloud instance.

Refer to [Plugins](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/migration-guide/cloud-migration-assistant/#plugins) for more information.

## Resolve errors and partial migrations

If some resources fail to migrate or the migration stalls during upload:

1. Review the **Status** column in the migration assistant for error details on affected resources.
1. Resolve the underlying issue on your self-managed instance, such as corrupt dashboard JSON or unsupported query formats.
1. Build a new snapshot and upload it again. The latest snapshot overwrites resources on your Grafana Cloud instance.

Large volumes of data can occasionally cause timeouts or rate limiting. If errors persist after you resolve individual resource issues, retry the upload or migrate resources in smaller batches by selecting fewer resource types when you build the snapshot.

## Dashboard migration failures

If specific dashboards fail to migrate:

1. Review the error details in the migration assistant to identify unsupported features or visualizations.
1. Modify the dashboard on your self-managed instance by removing or replacing unsupported elements, then build and upload a new snapshot.
1. Test the dashboard locally on your self-managed instance before you attempt migration again.
