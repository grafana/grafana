---
aliases:
  - ../data-sources/prometheus/
  - ../features/datasources/prometheus/
description: Guide for authenticating with Azure Monitor Managed Service for Prometheus in Grafana
keywords:
  - grafana
  - prometheus
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Authenticating with Azure
title: Configure the Prometheus data source
weight: 200
---

# Connect to Azure Monitor Managed Service for Prometheus

This page explains how to authenticate the Azure Monitor Managed Service for Prometheus data source. Choose the right method based on where Grafana runs and your security requirements.

## Supported authentication methods

The following table lists supported authentication methods and their trade-offs:

| Method                   | Best for                           | Grafana Cloud | Supports alerting | Server configuration required |
| ------------------------ | ---------------------------------- | ------------- | ----------------- | ---------------------- |
| **App Registration**     | Any Grafana deployment             | ✓             | ✓                 | No                     |
| **Managed Identity**     | Grafana hosted in Azure            | ✗             | ✓                 | Yes                    |
| **Workload Identity**    | Grafana in Kubernetes (AKS)        | ✗             | ✓                 | Yes                    |
| **Current User**         | User-level access control          | ✓             | Partial            | Yes                    |

{{< admonition type="note" >}}
**Certificate-based authentication is not supported** for the Azure Monitor Managed Service for Prometheus data source. If your organization requires certificate-based auth, use the [Azure Monitor data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/configure/), which supports App Registration with client certificates.
{{< /admonition >}}

**Current User** authentication doesn't support background operations like alerting and recording rules because user credentials aren't available for those processes. To use alerting with Current User, configure **fallback service credentials** (an App Registration). Alerts then run under the fallback credential's permissions, not the user's.

### Grafana Cloud requirements

{{< admonition type="caution" >}}
**Grafana Cloud users** connecting to Azure resources in a private network should use [Private Data Source Connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) rather than the deprecated `azure_auth_enabled` flag. If you're not using PDC and need Azure AD authentication enabled, [contact Grafana Support](https://grafana.com/help/) to have the `azure_auth_enabled` backend flag enabled on your Cloud stack. Without this flag, queries return `401 Unauthorized` errors.
{{< /admonition >}}

Managed Identity and Workload Identity are not available in Grafana Cloud because they require Grafana to run on your Azure infrastructure. Use **App Registration** or **Current User** authentication instead.

### Self-managed server configuration

For self-managed Grafana, Managed Identity, Workload Identity, and Current User authentication methods require settings in the Grafana `.ini` configuration file. Additionally, the Azure Monitor Managed Service for Prometheus plugin must be included in `forward_settings_to_plugins` so that it receives the Azure settings from the server.

Verify that `grafana-azureprometheus-datasource` is listed in `forward_settings_to_plugins` under the `[azure]` section of your `.ini` file:

```ini
[azure]
managed_identity_enabled = true
forward_settings_to_plugins = grafana-azure-monitor-datasource grafana-azureprometheus-datasource
```

{{< admonition type="note" >}}
By default, Grafana includes all Grafana Labs Azure plugins in `forward_settings_to_plugins`. If you've customized this setting, ensure `grafana-azureprometheus-datasource` is included. Missing this setting is a common cause of `401 Unauthorized` errors.
{{< /admonition >}}

Refer to [Configure Grafana Azure settings](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#azure) for all available Azure configuration options.

## Configure the data source

After creating an Azure Monitor Managed Service for Prometheus data source:

1. In the data source configuration page, locate the **Authentication** section.
1. Select your authentication method:
   - **Managed Identity**: For Azure-hosted Grafana instances. Refer to [Configure Entra ID OAuth authentication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-access/configure-authentication/azuread/#configure-azure-adentra-id-oauth-authentication) for details.
   - **App Registration**: For service principal authentication.
   - **Current User**: Uses the current user's Entra ID credentials.
1. Configure based on your chosen method:

| Setting                     | Description                     | Example                                |
| --------------------------- | ------------------------------- | -------------------------------------- |
| **Directory (tenant) ID**   | Your Entra ID tenant ID         | `12345678-1234-1234-1234-123456789012` |
| **Application (client) ID** | Your app registration client ID | `87654321-4321-4321-4321-210987654321` |
| **Client secret**           | Your app registration secret    | `your-client-secret`                   |

When using Managed Identity for authentication:

- No additional configuration required if using system-assigned identity.
- For user-assigned identity, provide the **Client ID**.

4. Set the **Prometheus server URL** to your Azure Monitor workspace endpoint:

   ```
   https://your-workspace.eastus2.prometheus.monitor.azure.com
   ```

5. Click **Save & test** to verify the connection.

## Example configuration

```yaml
# Example provisioning configuration for App Registration
apiVersion: 1
datasources:
  - name: 'Azure Monitor Prometheus'
    type: 'grafana-azureprometheus-datasource'
    url: 'https://your-workspace.eastus2.prometheus.monitor.azure.com'
    jsonData:
      azureCredentials:
        authType: 'clientsecret'
        azureCloud: 'AzureCloud'
        clientId: '<client_id>'
        httpMethod: 'POST'
        tenantId: '<tenant_id>'
    secureJsonData:
      clientSecret: 'your-client-secret'
```

## Migrate to Azure Monitor Managed Service for Prometheus

Learn more about why this is happening: [Prometheus data source update: Redefining our big tent philosophy](https://grafana.com/blog/2025/06/16/prometheus-data-source-update-redefining-our-big-tent-philosophy/)

Before you begin, ensure you have the organization administrator role. If you are self-hosting Grafana, back up your existing dashboard configurations and queries.

Grafana Cloud users are automatically migrated to the relevant version of Prometheus, so no action needs to be taken.

For air-gapped environments, download and install [Azure Monitor Managed Service for Prometheus](https://grafana.com/grafana/plugins/grafana-azureprometheus-datasource/), then follow the standard migration process.

### Migrate

1. Enable the `prometheusTypeMigration` feature toggle. For more information on feature toggles, refer to [Manage feature toggles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/#manage-feature-toggles).
2. Restart Grafana for the changes to take effect.

{{< admonition type="note" >}}
This feature toggle will be removed in Grafana 13, and the migration will be automatic.
{{< /admonition >}}

To determine if your Prometheus data sources have been migrated:

1. Navigate to **Connections** > **Data sources**
2. Select your Prometheus data source
3. Look for a migration banner at the top of the configuration page

The banner displays one of the following messages:

- **"Migration Notice"** - The data source has already been migrated
- **"Deprecation Notice"** - The data source has not been migrated
- **No banner** - No migration is needed for this data source

## Common migration issues

The following sections contain troubleshooting guidance.

**Migration banner not appearing**

- Verify the `prometheusTypeMigration` feature toggle is enabled.
- Restart Grafana after enabling the feature toggle

**Azure Monitor Managed Service for Prometheus is not installed**

- Verify that Azure Monitor Managed Service for Prometheus is installed by going to **Connections** > **Add new connection** and search for "Azure Monitor Managed Service for Prometheus"
- Install Azure Monitor Managed Service for Prometheus if not already installed

**After migrating, my data source returns "401 Unauthorized"**

- **Self-managed Grafana:** Verify that `grafana-azureprometheus-datasource` is included in `forward_settings_to_plugins` under the `[azure]` section of your `.ini` file. Refer to [Self-managed server configuration](#self-managed-server-configuration) for details.
- **Grafana Cloud:** The `azure_auth_enabled` backend flag may not be enabled on your stack. Use [Private Data Source Connect (PDC)](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) if connecting to private Azure resources, or [contact Grafana Support](https://grafana.com/help/) to have the flag enabled.

### Rollback self-managed Grafana without a backup

If you don’t have a backup of your Grafana instance before the migration, remove the `prometheusTypeMigration` feature toggle, and run the following script. It reverts all the Azure Monitor Managed Service data source instances back to core Prometheus.

To revert the migration:

1. Disable the `prometheusTypeMigration` feature toggle. For more information on feature toggles, refer to [Manage feature toggles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/#manage-feature-toggles).
2. Obtain a bearer token that has `read` and `write` permissions for your Grafana data source API. For more information on the data source API, refer to [Data source API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/data_source/).
3. Run the script below. Make sure to provide your Grafana URL and bearer token.
4. (Optional) Report the issue you were experiencing on the [Grafana repository](https://github.com/grafana/grafana/issues). Tag the issue with "datasource/migrate-prometheus-type"

```bash
#!/bin/bash

# Configuration
GRAFANA_URL=""
BEARER_TOKEN=""
LOG_FILE="grafana_migration_$(date +%Y%m%d_%H%M%S).log"

# Function to log messages to both console and file
log_message() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $message" | tee -a "$LOG_FILE"
}

# Function to update a data source
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
        log_message "$uid successful"
    else
        log_message "$uid error: HTTP $http_code - $response_body"
    fi
}

# Function to process and update data source types
update_data_source_type() {
    local result="$1"
    local processed_count=0
    local updated_count=0
    local readonly_count=0
    local skipped_count=0

    # Use jq to parse and process JSON
    echo "$result" | jq -c '.[]' | while read -r data; do
        uid=$(echo "$data" | jq -r '.uid')
        prometheus_type_migration=$(echo "$data" | jq -r '.jsonData["prometheus-type-migration"] // false')
        data_type=$(echo "$data" | jq -r '.type')
        read_only=$(echo "$data" | jq -r '.readOnly // false')

        processed_count=$((processed_count + 1))

        # Check conditions
        if [[ "$prometheus_type_migration" != "true" ]] || [[ "$data_type" != "grafana-azureprometheus-datasource" ]]; then
            skipped_count=$((skipped_count + 1))
            continue
        fi

        if [[ "$read_only" == "true" ]]; then
            readonly_count=$((readonly_count + 1))
            log_message "$uid is readOnly. If this data source is provisioned, edit the data source type to be \`prometheus\` in the provisioning file."
            continue
        fi

        # Update the data
        updated_data=$(echo "$data" | jq '.type = "prometheus" | .jsonData["prometheus-type-migration"] = false')
        update_data_source "$uid" "$updated_data"
        updated_count=$((updated_count + 1))

        # Log the raw data for debugging (optional - uncomment if needed)
        # log_message "DEBUG - Updated data for $uid: $updated_data"
    done

    # Note: These counts won't work in the while loop due to subshell
    # Moving summary to the main function instead
}

# Function to get summary statistics
get_summary_stats() {
    local result="$1"
    local total_datasources=$(echo "$result" | jq '. | length')
    local migration_candidates=$(echo "$result" | jq '[.[] | select(.jsonData["prometheus-type-migration"] == true and .type == "grafana-azureprometheus-datasource")] | length')
    local readonly_candidates=$(echo "$result" | jq '[.[] | select(.jsonData["prometheus-type-migration"] == true and .type == "grafana-azureprometheus-datasource" and .readOnly == true)] | length')
    local updateable_candidates=$(echo "$result" | jq '[.[] | select(.jsonData["prometheus-type-migration"] == true and .type == "grafana-azureprometheus-datasource" and (.readOnly == false or .readOnly == null))] | length')

    log_message "=== MIGRATION SUMMARY ==="
    log_message "Total data sources found: $total_datasources"
    log_message "Migration candidates found: $migration_candidates"
    log_message "Read-only candidates (will be skipped): $readonly_candidates"
    log_message "Updateable candidates: $updateable_candidates"
    log_message "=========================="
}

# Main function to remove Prometheus type migration
remove_prometheus_type_migration() {
    log_message "Starting remove Azure Prometheus migration"
    log_message "Log file: $LOG_FILE"
    log_message "Grafana URL: $GRAFANA_URL"

    response=$(curl -s -w "\n%{http_code}" -X GET \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $BEARER_TOKEN" \
        "$GRAFANA_URL/api/datasources/")

    http_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | sed '$d')

    if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
        log_message "Successfully fetched data sources"
        get_summary_stats "$response_body"
        update_data_source_type "$response_body"
        log_message "Migration process completed"
    else
        log_message "error fetching data sources: HTTP $http_code - $response_body"
    fi
}

# Function to initialize log file
initialize_log() {
    echo "=== Grafana Azure Prometheus Migration Log ===" > "$LOG_FILE"
    echo "Started at: $(date)" >> "$LOG_FILE"
    echo "=============================================" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install jq to run this script."
    exit 1
fi

# Check if required variables are set
if [[ -z "$GRAFANA_URL" || -z "$BEARER_TOKEN" ]]; then
    echo "Error: Please set GRAFANA_URL and BEARER_TOKEN variables at the top of the script."
    exit 1
fi

# Initialize log file
initialize_log

# Execute main function
log_message "Script started"
remove_prometheus_type_migration
log_message "Script completed"

# Final log message
echo ""
echo "Migration completed. Full log available at: $LOG_FILE"
```

If you continue to experience issues, check the Grafana server logs for detailed error messages and contact [Grafana Support](https://grafana.com/help/) with your troubleshooting results.
