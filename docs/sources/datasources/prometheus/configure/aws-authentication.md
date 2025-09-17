---
aliases:
  - ../data-sources/prometheus/
  - ../features/datasources/prometheus/
description: Guide for authenticating with Amazon Managed Service for Prometheus in Grafana
keywords:
  - grafana
  - prometheus
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Authenticating with SigV4
title: Configure the Prometheus data source
weight: 200
refs:
  intro-to-prometheus:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/intro-to-prometheus/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/intro-to-prometheus/
  exemplars:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/fundamentals/exemplars/
  configure-data-links-value-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-data-links/#value-variables
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/configure-data-links/#value-variables
  alerting-alert-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/
  add-a-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/#add-a-data-source
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/#add-a-data-source
  prom-query-editor:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/query-editor
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/query-editor
  default-manage-alerts-ui-toggle:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#default_manage_alerts_ui_toggle
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#default_manage_alerts_ui_toggle
  provision-grafana:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/
  manage-alerts-toggle:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#default_manage_alerts_ui_toggle
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#default_manage_alerts_ui_toggle
  manage-recording-rules-toggle:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#default_allow_recording_rules_target_alerts_ui_toggle
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#default_allow_recording_rules_target_alerts_ui_toggle
  private-data-source-connect:
    - pattern: /docs/grafana/
      destination: docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
    - pattern: /docs/grafana-cloud/
      destination: docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
  configure-pdc:
    - pattern: /docs/grafana/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc
  azure-active-directory:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/#configure-azure-active-directory-ad-authentication
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/azure-monitor/#configure-azure-active-directory-ad-authentication
  configure-grafana-configuration-file-location:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#configuration-file-location
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#configuration-file-location
  grafana-managed-recording-rules:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/
---
# Connect to Amazon Managed Service for Prometheus

1. In the data source configuration page, locate the **Auth** section
2. Enable **SigV4 auth**
3. Configure the following settings:

   | Setting | Description | Example |
   |---------|-------------|---------|
   | **Authentication Provider** | Choose your auth method | `AWS SDK Default`, `Access & secret key`, or `Credentials file` |
   | **Default Region** | AWS region for your workspace | `us-west-2` |
   | **Access Key ID** | Your AWS access key (if using access key auth) | `AKIA...` |
   | **Secret Access Key** | Your AWS secret key (if using access key auth) | `wJalrXUtn...` |
   | **Assume Role ARN** | IAM role ARN (optional) | `arn:aws:iam::123456789:role/GrafanaRole` |

4. Set the **HTTP URL** to your Amazon Managed Service for Prometheus workspace endpoint:
   ```
   https://aps-workspaces.us-west-2.amazonaws.com/workspaces/ws-12345678-1234-1234-1234-123456789012/
   ```

5. Click **Save & test** to verify the connection

## Example configuration

```yaml
# Example provisioning configuration
apiVersion: 1
datasources:
  - name: Amazon Managed Prometheus
    type: grafana-amazonprometheus-datasource
    access: proxy
    url: https://aps-workspaces.us-west-2.amazonaws.com/workspaces/ws-12345678-1234-1234-1234-123456789012/
    jsonData:
      sigV4Auth: true
      sigV4AuthType: default
      sigV4Region: us-west-2
```

# Migrate to Amazon Managed Service for Prometheus

Learn more about why this is happening: [Prometheus data source update: Redefining our big tent philosophy](https://grafana.com/blog/2025/06/16/prometheus-data-source-update-redefining-our-big-tent-philosophy/)

## Before you begin

- Ensure you have the organization administrator role
- If you are self hosting Grafana, back up your existing dashboard configurations and queries

## Migrate on grafana Cloud

grafana Cloud users will be automatically migrated to the relevant version of Prometheus. No action needs to be taken.

## Migrate in air-gapped environments

For air-gapped Grafana installations:

1. Download and install [Amazon Managed Service for Prometheus](https://grafana.com/grafana/plugins/grafana-amazonprometheus-datasource/)
2. Follow the standard migration process

## Migrate

1. Enable the `prometheusTypeMigration` feature toggle. For more information on feature toggles, refer to [Manage feature toggles](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/#manage-feature-toggles). 
2. Restart Grafana for the changes to take effect.

**Note**: This feature toggle will be removed in Grafana 13, and the migration will be automatic.

## Check migration status

To determine if your Prometheus data sources have been migrated:

1. Navigate to **Connections** > **Data sources**
2. Select your Prometheus data source
3. Look for a migration banner at the top of the configuration page

The banner displays one of the following messages:

- **"Migration Notice"** - The data source has already been migrated
- **"Deprecation Notice"** - The data source has not been migrated
- **No banner** - No migration is needed for this data source

## Troubleshooting

### Common migration issues

**Migration banner not appearing**
- Verify the `prometheusTypeMigration` feature toggle is enabled
- Restart Grafana after enabling the feature toggle

**Amazon Managed Service for Prometheus is not installed**
- Verify that Amazon Managed Service for Prometheus is installed by going to **Connections** > **Add new connection** and search for "Amazon Managed Service for Prometheus"
- Install Amazon Managed Service for Prometheus if not already installed

### Rolling the migration back without a backup

If you do not have a backup of your Grafana instance before the migration, you can run the script below. It will find all the Amazon Managed Service for Prometheus data source instances that were migrated from core Prometheus and revert them back to core Prometheus.

To revert the migration:

1. Disable the `prometheusTypeMigration` feature toggle. For more information on feature toggles, refer to [Manage feature toggles](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/#manage-feature-toggles). 
2. Obtain a bearer token that has `read` and `write` permissions for your Grafana data source API. For more information on the data source API, refer to [Data source API](https://grafana.com/docs/grafana/latest/developers/http_api/data_source/).
3. Run the script below. Make sure to provide your Grafana URL and bearer token.
4. (Optional) Report the issue you were experiencing at [grafana/grafana](https://github.com/grafana/grafana/issues). Tag the issue with "datasource/migrate-prometheus-type"

```bash
#!/bin/bash

GRAFANA_URL=""
BEARER_TOKEN=""

# Function to update a data source
update_data_source() {
    local uid="$1"
    local data="$2"
    
    local response=$(curl -s -X PUT \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $BEARER_TOKEN" \
        -d "$data" \
        "$GRAFANA_URL/api/datasources/uid/$uid")
    
    echo "$response"
    echo "$data"
}

# Function to update data source type
update_data_source_type() {
    local result="$1"
    
    # Process each data source in the JSON array
    echo "$result" | jq -c '.[]' | while read -r data; do
        local uid=$(echo "$data" | jq -r '.uid')
        local prometheus_migration=$(echo "$data" | jq -r '.jsonData["prometheus-type-migration"] // false')
        local read_only=$(echo "$data" | jq -r '.readOnly // false')
        
        # Skip if prometheus-type-migration is not true
        if [ "$prometheus_migration" != "true" ]; then
            continue
        fi
        
        # Skip if read-only
        if [ "$read_only" = "true" ]; then
            echo "$uid is readOnly. If this data source is provisioned, edit the data source type to be 'prometheus' in the provisioning file."
            continue
        fi
        
        # Update the data source
        local updated_data=$(echo "$data" | jq '.type = "prometheus" | .jsonData["prometheus-type-migration"] = false')
        update_data_source "$uid" "$updated_data"
    done
}

# Main function to remove prometheus type migration
remove_prometheus_type_migration() {
    local response=$(curl -s -X GET \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $BEARER_TOKEN" \
        "$GRAFANA_URL/api/datasources/")
    
    if [ $? -eq 0 ]; then
        update_data_source_type "$response"
    else
        echo "Error: Failed to fetch data sources" >&2
        exit 1
    fi
}

# Check if required variables are set
if [ -z "$GRAFANA_URL" ] || [ -z "$BEARER_TOKEN" ]; then
    echo "Error: Please set GRAFANA_URL and BEARER_TOKEN variables" >&2
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Please install jq to run this script." >&2
    exit 1
fi

# Run the main function
remove_prometheus_type_migration
```

### Getting help

If you continue to experience issues check the Grafana server logs for detailed error messages and contact support with your troubleshooting results.
