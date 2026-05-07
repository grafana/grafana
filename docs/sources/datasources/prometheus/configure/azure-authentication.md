---
aliases:
  - ../data-sources/prometheus/
  - ../features/datasources/prometheus/
description: Migrating from Prometheus Azure AD authentication to the Azure Monitor Managed Service for Prometheus data source
keywords:
  - grafana
  - prometheus
  - azure
  - azure ad
  - azure monitor
  - managed prometheus
  - migration
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Azure authentication (deprecated)
title: Migrate from Prometheus Azure AD to Azure Monitor Managed Service for Prometheus
weight: 200
review_date: 2026-05-07
---

# Migrate from Prometheus Azure AD to Azure Monitor Managed Service for Prometheus

{{< admonition type="warning" >}}
Using Azure AD authentication with the core Prometheus data source for Azure Monitor Managed Service for Prometheus is **deprecated**. In Grafana 13, the migration to the dedicated [Azure Monitor Managed Service for Prometheus data source](https://grafana.com/grafana/plugins/grafana-azureprometheus-datasource/) is automatic. Existing data sources using Azure AD authentication are migrated on startup.
{{< /admonition >}}

For background on this change, refer to [Prometheus data source update: Redefining our big tent philosophy](https://grafana.com/blog/2025/06/16/prometheus-data-source-update-redefining-our-big-tent-philosophy/).

## What changed in Grafana 13

In Grafana 13, the `prometheusTypeMigration` feature toggle is enabled by default and deprecated. This means:

- Prometheus data sources configured with Azure AD authentication are **automatically migrated** to the dedicated Azure Monitor Managed Service for Prometheus plugin on Grafana startup.
- You no longer need to manually enable the feature toggle.
- Grafana Cloud users are migrated automatically with no action required.
- Dashboards, alerts, and queries continue to work after migration without changes.

## Check migration status

To determine if your Prometheus data sources have been migrated:

1. Navigate to **Connections** > **Data sources**.
1. Select your Prometheus data source.
1. Look for a migration banner at the top of the configuration page.

The banner displays one of the following messages:

- **"Migration Notice"** — The data source has been migrated to the Azure Monitor Managed Service for Prometheus plugin.
- **"Deprecation Notice"** — The data source hasn't been migrated yet.
- **No banner** — No migration is needed (the data source doesn't use Azure AD authentication).

## Configure the Azure Monitor Managed Service for Prometheus data source

After migration (or for new setups), configure the dedicated plugin:

1. Navigate to **Connections** > **Data sources**.
1. Select your Azure Monitor Managed Service for Prometheus data source.
1. In the **Authentication** section, select your authentication method:

| Method               | Use case                          | Additional configuration required          |
| -------------------- | --------------------------------- | ------------------------------------------ |
| **Managed Identity** | Azure-hosted Grafana instances    | None (system-assigned) or Client ID (user-assigned) |
| **App Registration** | Service principal authentication  | Directory ID, Application ID, Client secret |
| **Current User**     | Current user's Entra ID credentials | None                                       |

For Managed Identity authentication:

- No additional configuration is required if using a system-assigned identity.
- For a user-assigned identity, provide the **Client ID**.

For App Registration authentication:

| Setting                     | Description                     | Example                                |
| --------------------------- | ------------------------------- | -------------------------------------- |
| **Directory (tenant) ID**   | Your Entra ID tenant ID         | `12345678-1234-1234-1234-123456789012` |
| **Application (client) ID** | Your app registration client ID | `87654321-4321-4321-4321-210987654321` |
| **Client secret**           | Your app registration secret    | `your-client-secret`                   |

To learn more about Entra ID authentication for Grafana, refer to [Configure Entra ID OAuth authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/azuread/#configure-azure-adentra-id-oauth-authentication).

4. Set the **Prometheus server URL** to your Azure Monitor workspace endpoint:

   ```
   https://your-workspace.eastus2.prometheus.monitor.azure.com
   ```

5. Click **Save & test** to verify the connection.

## Provision the data source

```yaml
apiVersion: 1
datasources:
  - name: Azure Monitor Prometheus
    type: grafana-azureprometheus-datasource
    url: https://your-workspace.eastus2.prometheus.monitor.azure.com
    jsonData:
      azureCredentials:
        authType: clientsecret
        azureCloud: AzureCloud
        clientId: <CLIENT_ID>
        tenantId: <TENANT_ID>
      httpMethod: POST
    secureJsonData:
      azureClientSecret: <CLIENT_SECRET>
```

Replace `<CLIENT_ID>`, `<TENANT_ID>`, and `<CLIENT_SECRET>` with your Azure credentials.

## Troubleshoot migration issues

### Azure Monitor Managed Service for Prometheus plugin not installed

**Symptom:** Migration doesn't occur or the data source type is missing.

**Solution:**

1. Navigate to **Connections** > **Add new connection** and search for "Azure Monitor Managed Service for Prometheus".
1. Install the plugin if it isn't already installed.
1. For air-gapped environments, download the plugin from [the Grafana plugin catalog](https://grafana.com/grafana/plugins/grafana-azureprometheus-datasource/) and install it manually.

### "401 Unauthorized" after migration

**Symptom:** The migrated data source returns authentication errors.

**Solution:**

1. **Self-hosted Grafana:** Verify that `grafana-azureprometheus-datasource` is included in `forward_settings_to_plugins` under the `[azure]` heading in your `.ini` configuration file.
1. **Grafana Cloud:** Contact [Grafana Support](https://grafana.com/profile/org#support).

### Rollback the migration

If you need to revert migrated data sources back to the core Prometheus type:

1. Set `prometheusTypeMigration` to `false` in your Grafana configuration feature toggles. For more information, refer to [Manage feature toggles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/#manage-feature-toggles).
1. Restart Grafana.
1. Obtain a bearer token with `read` and `write` permissions for the data source API. For more information, refer to [Data source API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/data_source/).
1. Run the following rollback script, providing your Grafana URL and bearer token:

```sh
#!/bin/bash

GRAFANA_URL=""
BEARER_TOKEN=""
LOG_FILE="grafana_azure_migration_rollback_$(date +%Y%m%d_%H%M%S).log"

log_message() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $message" | tee -a "$LOG_FILE"
}

update_data_source() {
    local uid="$1"
    local data="$2"

    response=$(curl -s -w "\n%{http_code}" -X PUT \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $BEARER_TOKEN" \
        -d "$data" \
        "$GRAFANA_URL/api/datasources/uid/$uid")

    http_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | sed '$d')

    if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
        log_message "$uid reverted successfully"
    else
        log_message "$uid error: HTTP $http_code - $response_body"
    fi
}

if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed."
    exit 1
fi

if [[ -z "$GRAFANA_URL" || -z "$BEARER_TOKEN" ]]; then
    echo "Error: Set GRAFANA_URL and BEARER_TOKEN variables at the top of the script."
    exit 1
fi

log_message "Starting Azure Prometheus to core Prometheus rollback"

response=$(curl -s -w "\n%{http_code}" -X GET \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $BEARER_TOKEN" \
    "$GRAFANA_URL/api/datasources/")

http_code=$(echo "$response" | tail -n1)
response_body=$(echo "$response" | sed '$d')

if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
    log_message "Error fetching data sources: HTTP $http_code"
    exit 1
fi

total=$(echo "$response_body" | jq '[.[] | select(.jsonData["prometheus-type-migration"] == true and .type == "grafana-azureprometheus-datasource")] | length')
log_message "Found $total data sources to revert"

echo "$response_body" | jq -c '.[] | select(.jsonData["prometheus-type-migration"] == true and .type == "grafana-azureprometheus-datasource")' | while read -r data; do
    uid=$(echo "$data" | jq -r '.uid')
    read_only=$(echo "$data" | jq -r '.readOnly // false')

    if [[ "$read_only" == "true" ]]; then
        log_message "$uid is readOnly — edit the type to 'prometheus' in the provisioning file instead."
        continue
    fi

    updated_data=$(echo "$data" | jq '.type = "prometheus" | .jsonData["prometheus-type-migration"] = false')
    update_data_source "$uid" "$updated_data"
done

log_message "Rollback complete. Log: $LOG_FILE"
```

{{< admonition type="note" >}}
Provisioned data sources (readOnly) can't be reverted via the API. Update the `type` field to `prometheus` in your provisioning YAML file instead.
{{< /admonition >}}

If you continue to experience issues, check the Grafana server logs for detailed error messages and contact [Grafana Support](https://grafana.com/help/).
