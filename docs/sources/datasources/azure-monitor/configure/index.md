---
aliases:
  - ../../data-sources/azure-monitor/configure/
description: Guide for configuring the Azure Monitor data source in Grafana.
keywords:
  - grafana
  - microsoft
  - azure
  - monitor
  - application
  - insights
  - log
  - analytics
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Configure
title: Configure the Azure Monitor data source
weight: 200
last_reviewed: 2025-12-04
---

# Configure the Azure Monitor data source

This document explains how to configure the Azure Monitor data source and the available configuration options.
For general information about data sources, refer to [Grafana data sources](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/) and [Data source management](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/).

## Before you begin

Before configuring the Azure Monitor data source, ensure you have the following:

- **Grafana permissions:** You must have the `Organization administrator` role to configure data sources.
  Organization administrators can also [configure the data source via YAML](#provision-the-data-source) with the Grafana provisioning system or [using Terraform](#configure-with-terraform).

- **Azure prerequisites:** Depending on your chosen authentication method, you may need:
  - A Microsoft Entra ID (formerly Azure AD) app registration with a service principal (for App Registration authentication)
  - A Managed Identity enabled on your Azure VM or App Service (for Managed Identity authentication)
  - Workload identity configured in your Kubernetes cluster (for Workload Identity authentication)
  - Microsoft Entra ID authentication configured for Grafana login (for Current User authentication)

{{< admonition type="note" >}}
**Grafana Cloud users:** Managed Identity and Workload Identity authentication methods are not available in Grafana Cloud because they require Grafana to run on your Azure infrastructure. Use **App Registration** authentication instead.
{{< /admonition >}}

- **Azure RBAC permissions:** The identity used to authenticate must have the `Reader` role on the Azure subscription containing the resources you want to monitor.
  For Log Analytics queries, the identity also needs appropriate permissions on the Log Analytics workspaces to be queried.
  Refer to the [Azure documentation for role assignments](https://docs.microsoft.com/en-us/azure/role-based-access-control/role-assignments-portal?tabs=current).

{{< admonition type="note" >}}
The Azure Monitor data source plugin is built into Grafana. No additional installation is required.
{{< /admonition >}}

## Add the data source

To add the Azure Monitor data source:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**.
1. Type `Azure Monitor` in the search bar.
1. Select **Azure Monitor**.
1. Click **Add new data source** in the upper right.

You're taken to the **Settings** tab where you can configure the data source.

## Choose an authentication method

The Azure Monitor data source supports four authentication methods. Choose based on where Grafana is hosted and your security requirements:

| Authentication method | Best for                                   | Requirements                                                   |
| --------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| **App Registration**  | Any Grafana deployment                     | Microsoft Entra ID app registration with client secret         |
| **Managed Identity**  | Grafana hosted in Azure (VMs, App Service) | Managed identity enabled on the Azure resource                 |
| **Workload Identity** | Grafana in Kubernetes (AKS)                | Workload identity federation configured                        |
| **Current User**      | User-level access control                  | Microsoft Entra ID authentication configured for Grafana login |

## Configure authentication

Select one of the following authentication methods and complete the configuration.

### App Registration

Use a Microsoft Entra ID app registration (service principal) to authenticate. This method works with any Grafana deployment.

#### App Registration prerequisites

1. Create an app registration in Microsoft Entra ID.
   Refer to the [Azure documentation for creating a service principal](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal#get-tenant-and-app-id-values-for-signing-in).

1. Create a client secret for the app registration.
   Refer to the [Azure documentation for creating a client secret](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal#option-2-create-a-new-application-secret).

1. Assign the `Reader` role to the app registration on the subscription or resources you want to monitor.
   Refer to the [Azure documentation for role assignments](https://docs.microsoft.com/en-us/azure/role-based-access-control/role-assignments-portal?tabs=current).

#### App Registration UI configuration

| Setting                     | Description                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Authentication**          | Select **App Registration**.                                                                                                               |
| **Azure Cloud**             | The Azure environment to connect to. Select **Azure** for the public cloud, or choose Azure Government or Azure China for national clouds. |
| **Directory (tenant) ID**   | The GUID that identifies your Microsoft Entra ID tenant.                                                                                   |
| **Application (client) ID** | The GUID for the app registration you created.                                                                                             |
| **Client secret**           | The secret key for the app registration. Keep this secure and rotate periodically.                                                         |
| **Default Subscription**    | Click **Load Subscriptions** to populate available subscriptions, then select your default.                                                |

#### Provision App Registration with YAML

```yaml
apiVersion: 1

datasources:
  - name: Azure Monitor
    type: grafana-azure-monitor-datasource
    access: proxy
    jsonData:
      azureAuthType: clientsecret
      cloudName: azuremonitor # See supported cloud names below
      tenantId: <tenant-id>
      clientId: <client-id>
      subscriptionId: <subscription-id> # Optional, default subscription
    secureJsonData:
      clientSecret: <client-secret>
    version: 1
```

### Managed Identity

Use Azure Managed Identity for secure, credential-free authentication when Grafana is hosted in Azure.

{{< admonition type="note" >}}
Managed Identity is available in [Azure Managed Grafana](https://azure.microsoft.com/en-us/products/managed-grafana) or self-hosted Grafana deployed in Azure. It is not available in Grafana Cloud.
{{< /admonition >}}

#### Managed Identity prerequisites

- Grafana must be hosted in Azure (App Service, Azure VMs, or Azure Managed Grafana).
- Managed identity must be enabled on the Azure resource hosting Grafana.
- The managed identity must have the `Reader` role on the subscription or resources you want to monitor.

For details on Azure managed identities, refer to the [Azure documentation](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview).

#### Managed Identity Grafana server configuration

Enable managed identity in the Grafana server configuration:

```ini
[azure]
managed_identity_enabled = true
```

To use a user-assigned managed identity instead of the system-assigned identity, also set:

```ini
[azure]
managed_identity_enabled = true
managed_identity_client_id = <USER_ASSIGNED_IDENTITY_CLIENT_ID>
```

Refer to [Grafana Azure configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#azure) for more details.

#### Managed Identity UI configuration

| Setting                  | Description                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| **Authentication**       | Select **Managed Identity**. The directory ID, application ID, and client secret fields are hidden. |
| **Default Subscription** | Click **Load Subscriptions** to populate available subscriptions, then select your default.         |

{{< figure src="/media/docs/grafana/data-sources/screenshot-managed-identity-2.png" max-width="800px" class="docs-image--no-shadow" caption="Azure Monitor data source configured with Managed Identity" >}}

#### Provision Managed Identity with YAML

```yaml
apiVersion: 1

datasources:
  - name: Azure Monitor
    type: grafana-azure-monitor-datasource
    access: proxy
    jsonData:
      azureAuthType: msi
      subscriptionId: <subscription-id> # Optional, default subscription
    version: 1
```

### Workload Identity

Use Azure Workload Identity for secure authentication in Kubernetes environments like AKS.

#### Workload Identity prerequisites

- Grafana must be running in a Kubernetes environment with workload identity federation configured.
- The workload identity must have the `Reader` role on the subscription or resources you want to monitor.

For details, refer to the [Azure workload identity documentation](https://azure.github.io/azure-workload-identity/docs/).

#### Workload Identity Grafana server configuration

Enable workload identity in the Grafana server configuration:

```ini
[azure]
workload_identity_enabled = true
```

Optional configuration variables:

```ini
[azure]
workload_identity_enabled = true
workload_identity_tenant_id = <IDENTITY_TENANT_ID>    # Microsoft Entra ID tenant containing the managed identity
workload_identity_client_id = <IDENTITY_CLIENT_ID>    # Client ID if different from default
workload_identity_token_file = <TOKEN_FILE_PATH>      # Path to the token file
```

Refer to [Grafana Azure configuration](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#azure) and the [Azure workload identity documentation](https://azure.github.io/azure-workload-identity/docs/) for more details.

#### Workload Identity UI configuration

| Setting                  | Description                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Authentication**       | Select **Workload Identity**. The directory ID, application ID, and client secret fields are hidden. |
| **Default Subscription** | Click **Load Subscriptions** to populate available subscriptions, then select your default.          |

{{< figure src="/media/docs/grafana/data-sources/screenshot-workload-identity.png" max-width="800px" class="docs-image--no-shadow" caption="Azure Monitor data source configured with Workload Identity" >}}

#### Provision Workload Identity with YAML

```yaml
apiVersion: 1

datasources:
  - name: Azure Monitor
    type: grafana-azure-monitor-datasource
    access: proxy
    jsonData:
      azureAuthType: workloadidentity
      subscriptionId: <subscription-id> # Optional, default subscription
    version: 1
```

### Current User

Forward the logged-in Grafana user's Azure credentials to the data source for user-level access control.

{{< admonition type="warning" >}}
Current User authentication is an [experimental feature](/docs/release-life-cycle/). Engineering and on-call support is not available. Documentation is limited. No SLA is provided. Contact Grafana Support to enable this feature in Grafana Cloud.
{{< /admonition >}}

#### Current User prerequisites

Your Grafana instance must be configured with Microsoft Entra ID authentication. Refer to the [Microsoft Entra ID authentication documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/azuread/).

#### Configure your Azure App Registration

The App Registration used for Grafana login requires additional configuration:

**Enable token issuance:**

1. In the Azure Portal, open your App Registration.
1. Select **Authentication** in the side menu.
1. Under **Implicit grant and hybrid flows**, check both **Access tokens** and **ID tokens**.
1. Save your changes.

**Add API permissions:**

1. In the Azure Portal, open your App Registration.
1. Select **API Permissions** in the side menu.
1. Ensure these permissions are present under **Microsoft Graph**: `openid`, `profile`, `email`, and `offline_access`.
1. Add the following permissions:
   - **Azure Service Management** > **Delegated permissions** > `user_impersonation`
   - **APIs my organization uses** > Search for **Log Analytics API** > **Delegated permissions** > `Data.Read`

Refer to the [Azure documentation](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-access-web-apis) for more information.

**Update Grafana scopes:**

Update the `scopes` section in your Grafana Azure authentication configuration to include the `.default` scope:

```
.default openid email profile
```

#### Current User Grafana server configuration

Enable current user authentication in the Grafana server configuration:

```ini
[azure]
user_identity_enabled = true
```

By default, this also enables fallback service credentials. To disable fallback credentials at the instance level:

```ini
[azure]
user_identity_enabled = true
user_identity_fallback_credentials_enabled = false
```

{{< admonition type="note" >}}
To use fallback service credentials, the [feature toggle](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles) `idForwarding` must be set to `true`.
{{< /admonition >}}

#### Limitations and fallback credentials

Current User authentication doesn't support backend functionality like alerting, reporting, and recorded queries because user credentials aren't available for background operations.

To support these features, configure **fallback service credentials**. When enabled, Grafana uses the fallback credentials for backend operations. Note that operations using fallback credentials are limited to the permissions of those credentials, not the user's permissions.

{{< admonition type="note" >}}
Query and resource caching is disabled by default for data sources using Current User authentication.
{{< /admonition >}}

#### Current User UI configuration

| Setting                          | Description                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| **Authentication**               | Select **Current User**.                                                                    |
| **Default Subscription**         | Click **Load Subscriptions** to populate available subscriptions, then select your default. |
| **Fallback Service Credentials** | Enable and configure credentials for backend features like alerting.                        |

{{< figure src="/media/docs/grafana/data-sources/screenshot-current-user.png" max-width="800px" class="docs-image--no-shadow" caption="Azure Monitor data source configured with Current User authentication" >}}

#### Provision Current User with YAML

{{< admonition type="note" >}}
The `oauthPassThru` property is required for Current User authentication. The `disableGrafanaCache` property prevents returning cached responses for resources users don't have access to.
{{< /admonition >}}

```yaml
apiVersion: 1

datasources:
  - name: Azure Monitor
    type: grafana-azure-monitor-datasource
    access: proxy
    jsonData:
      azureAuthType: currentuser
      oauthPassThru: true
      disableGrafanaCache: true
      subscriptionId: <subscription-id> # Optional, default subscription
    version: 1
```

## Additional configuration options

These settings apply to all authentication methods.

### General settings

| Setting     | Description                                                                     |
| ----------- | ------------------------------------------------------------------------------- |
| **Name**    | The data source name used in panels and queries. Example: `azure-monitor-prod`. |
| **Default** | Toggle to make this the default data source for new panels.                     |

### Enable Basic Logs

Toggle **Enable Basic Logs** to allow queries against [Basic Logs tables](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/basic-logs-query?tabs=portal-1) in supported Log Analytics Workspaces.

{{< admonition type="note" >}}
Querying Basic Logs tables incurs additional costs on a per-query basis.
{{< /admonition >}}

### Private data source connect (Grafana Cloud only)

If you're using Grafana Cloud and need to connect to Azure resources in a private network, use Private Data Source Connect (PDC).

1. Click the **Private data source connect** dropdown to select your PDC configuration.
1. Click **Manage private data source connect** to view your PDC connection details.

For more information, refer to [Private data source connect](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) and [Configure PDC](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc).

## Supported cloud names

When provisioning the data source, use the following `cloudName` values:

| Azure Cloud                      | `cloudName` value        |
| -------------------------------- | ------------------------ |
| Microsoft Azure public cloud     | `azuremonitor` (default) |
| Microsoft Chinese national cloud | `chinaazuremonitor`      |
| US Government cloud              | `govazuremonitor`        |

{{< admonition type="note" >}}
For Current User authentication, the cloud names differ: use `AzureCloud` for public cloud, `AzureChinaCloud` for the Chinese national cloud, and `AzureUSGovernment` for the US Government cloud.
{{< /admonition >}}

## Verify the connection

After configuring the data source, click **Save & test**. A successful connection displays a message confirming that the credentials are valid and have access to the configured default subscription.

If the test fails, verify:

- Your credentials are correct (tenant ID, client ID, client secret)
- The identity has the required Azure RBAC permissions
- For Managed Identity or Workload Identity, that the Grafana server configuration is correct
- Network connectivity to Azure endpoints

## Provision the data source

You can define and configure the Azure Monitor data source in YAML files as part of the Grafana provisioning system.
For more information about provisioning, refer to [Provisioning Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources).

### Provision quick reference

| Authentication method | `azureAuthType` value | Required fields                                    |
| --------------------- | --------------------- | -------------------------------------------------- |
| App Registration      | `clientsecret`        | `tenantId`, `clientId`, `clientSecret`             |
| Managed Identity      | `msi`                 | None (uses VM identity)                            |
| Workload Identity     | `workloadidentity`    | None (uses pod identity)                           |
| Current User          | `currentuser`         | `oauthPassThru: true`, `disableGrafanaCache: true` |

All methods support the optional `subscriptionId` field to set a default subscription.

For complete YAML examples, see the [authentication method sections](#configure-authentication) above.

## Configure with Terraform

You can configure the Azure Monitor data source using the [Grafana Terraform provider](https://registry.terraform.io/providers/grafana/grafana/latest/docs). This approach enables infrastructure-as-code workflows and version control for your Grafana configuration.

### Terraform prerequisites

- [Terraform](https://www.terraform.io/downloads) installed
- Grafana Terraform provider configured with appropriate credentials
- For Grafana Cloud: A [Cloud Access Policy token](https://grafana.com/docs/grafana-cloud/account-management/authentication-and-permissions/access-policies/) with data source permissions

### Provider configuration

Configure the Grafana provider to connect to your Grafana instance:

```hcl
terraform {
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = ">= 2.0.0"
    }
  }
}

# For Grafana Cloud
provider "grafana" {
  url  = "<YOUR_GRAFANA_CLOUD_STACK_URL>"
  auth = "<YOUR_SERVICE_ACCOUNT_TOKEN>"
}

# For self-hosted Grafana
# provider "grafana" {
#   url  = "http://localhost:3000"
#   auth = "<API_KEY_OR_SERVICE_ACCOUNT_TOKEN>"
# }
```

### Terraform examples

The following examples show how to configure the Azure Monitor data source for each authentication method.

**App Registration (client secret):**

```hcl
resource "grafana_data_source" "azure_monitor" {
  type = "grafana-azure-monitor-datasource"
  name = "Azure Monitor"

  json_data_encoded = jsonencode({
    azureAuthType  = "clientsecret"
    cloudName      = "azuremonitor"
    tenantId       = "<TENANT_ID>"
    clientId       = "<CLIENT_ID>"
    subscriptionId = "<SUBSCRIPTION_ID>"
  })

  secure_json_data_encoded = jsonencode({
    clientSecret = "<CLIENT_SECRET>"
  })
}
```

**Managed Identity:**

```hcl
resource "grafana_data_source" "azure_monitor" {
  type = "grafana-azure-monitor-datasource"
  name = "Azure Monitor"

  json_data_encoded = jsonencode({
    azureAuthType  = "msi"
    subscriptionId = "<SUBSCRIPTION_ID>"
  })
}
```

**Workload Identity:**

```hcl
resource "grafana_data_source" "azure_monitor" {
  type = "grafana-azure-monitor-datasource"
  name = "Azure Monitor"

  json_data_encoded = jsonencode({
    azureAuthType  = "workloadidentity"
    subscriptionId = "<SUBSCRIPTION_ID>"
  })
}
```

**Current User:**

```hcl
resource "grafana_data_source" "azure_monitor" {
  type = "grafana-azure-monitor-datasource"
  name = "Azure Monitor"

  json_data_encoded = jsonencode({
    azureAuthType       = "currentuser"
    oauthPassThru       = true
    disableGrafanaCache = true
    subscriptionId      = "<SUBSCRIPTION_ID>"
  })
}
```

**With Basic Logs enabled:**

Add `enableBasicLogs = true` to any of the above configurations:

```hcl
resource "grafana_data_source" "azure_monitor" {
  type = "grafana-azure-monitor-datasource"
  name = "Azure Monitor"

  json_data_encoded = jsonencode({
    azureAuthType   = "clientsecret"
    cloudName       = "azuremonitor"
    tenantId        = "<TENANT_ID>"
    clientId        = "<CLIENT_ID>"
    subscriptionId  = "<SUBSCRIPTION_ID>"
    enableBasicLogs = true
  })

  secure_json_data_encoded = jsonencode({
    clientSecret = "<CLIENT_SECRET>"
  })
}
```

For more information about the Grafana Terraform provider, refer to the [provider documentation](https://registry.terraform.io/providers/grafana/grafana/latest/docs) and the [grafana_data_source resource](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/data_source).
