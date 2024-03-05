---
aliases:
  - ../data-sources/azure-monitor/
  - ../features/datasources/azuremonitor/
  - azuremonitor/
  - azuremonitor/deprecated-application-insights/
description: Guide for using Azure Monitor in Grafana
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
menuTitle: Azure Monitor
title: Azure Monitor data source
weight: 300
---

# Azure Monitor data source

Grafana ships with built-in support for Azure Monitor, the Azure service to maximize the availability and performance of applications and services in the Azure Cloud.
This topic explains configuring and querying specific to the Azure Monitor data source.

For instructions on how to add a data source to Grafana, refer to the [administration documentation][data-source-management].
Only users with the organization administrator role can add data sources.

Once you've added the Azure Monitor data source, you can [configure it](#configure-the-data-source) so that your Grafana instance's users can create queries in its [query editor]({{< relref "./query-editor" >}}) when they [build dashboards][build-dashboards] and use [Explore][explore].

The Azure Monitor data source supports visualizing data from four Azure services:

- **Azure Monitor Metrics:** Collect numeric data from resources in your Azure account.
- **Azure Monitor Logs:** Collect log and performance data from your Azure account, and query using the Kusto Query Language (KQL).
- **Azure Resource Graph:** Query your Azure resources across subscriptions.
- **Azure Monitor Application Insights:** Collect trace logging data and other application performance metrics.

## Configure the data source

**To access the data source configuration page:**

1. Click **Connections** in the left-side menu.
1. Under Your connections, click **Data sources**.
1. Enter `Azure Monitor` in the search bar.
1. Click **Azure Monitor**.

   The **Settings** tab of the data source is displayed.

### Configure Azure Active Directory (AD) authentication

You must create an app registration and service principal in Azure AD to authenticate the data source.
For configuration details, refer to the [Azure documentation for service principals](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal#get-tenant-and-app-id-values-for-signing-in).

The app registration you create must have the `Reader` role assigned on the subscription.
For more information, refer to [Azure documentation for role assignments](https://docs.microsoft.com/en-us/azure/role-based-access-control/role-assignments-portal?tabs=current).

If you host Grafana in Azure, such as in App Service or Azure Virtual Machines, you can configure the Azure Monitor data source to use Managed Identity for secure authentication without entering credentials into Grafana.
For details, refer to [Configuring using Managed Identity](#configuring-using-managed-identity).

You can configure the Azure Monitor data source to use Workload Identity for secure authentication without entering credentials into Grafana if you host Grafana in a Kubernetes environment, such as AKS, and require access to Azure resources.
For details, refer to [Configuring using Workload Identity](#configuring-using-workload-identity).

| Name                        | Description                                                                                                                                                                                                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**          | Enables Managed Identity. Selecting Managed Identity hides many of the other fields. For details, see [Configuring using Managed Identity](#configuring-using-managed-identity).                                                                                                                      |
| **Azure Cloud**             | Sets the national cloud for your Azure account. For most users, this is the default "Azure". For details, see the [Azure documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/authentication-national-cloud).                                                               |
| **Directory (tenant) ID**   | Sets the directory/tenant ID for the Azure AD app registration to use for authentication. For details, see the [Azure tenant and app ID docs](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal#get-tenant-and-app-id-values-for-signing-in).     |
| **Application (client) ID** | Sets the application/client ID for the Azure AD app registration to use for authentication.                                                                                                                                                                                                           |
| **Client secret**           | Sets the application client secret for the Azure AD app registration to use for authentication. For details, see the [Azure application secret docs](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal#option-2-create-a-new-application-secret). |
| **Default subscription**    | _(Optional)_ Sets a default subscription for template variables to use.                                                                                                                                                                                                                               |

### Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana][provisioning-data-sources].

#### Provisioning examples

**Azure AD App Registration (client secret):**

```yaml
apiVersion: 1 # config file version

datasources:
  - name: Azure Monitor
    type: grafana-azure-monitor-datasource
    access: proxy
    jsonData:
      azureAuthType: clientsecret
      cloudName: azuremonitor # See table below
      tenantId: <tenant-id>
      clientId: <client-id>
      subscriptionId: <subscription-id> # Optional, default subscription
    secureJsonData:
      clientSecret: <client-secret>
    version: 1
```

**Managed Identity:**

```yaml
apiVersion: 1 # config file version

datasources:
  - name: Azure Monitor
    type: grafana-azure-monitor-datasource
    access: proxy
    jsonData:
      azureAuthType: msi
      subscriptionId: <subscription-id> # Optional, default subscription
    version: 1
```

**Workload Identity:**

```yaml
apiVersion: 1 # config file version

datasources:
  - name: Azure Monitor
    type: grafana-azure-monitor-datasource
    access: proxy
    jsonData:
      azureAuthType: workloadidentity
      subscriptionId: <subscription-id> # Optional, default subscription
    version: 1
```

#### Supported cloud names

| Azure Cloud                          | `cloudName` Value          |
| ------------------------------------ | -------------------------- |
| **Microsoft Azure public cloud**     | `azuremonitor` (_Default_) |
| **Microsoft Chinese national cloud** | `chinaazuremonitor`        |
| **US Government cloud**              | `govazuremonitor`          |

### Configure Managed Identity

You can use managed identity to configure Azure Monitor in Grafana if you host Grafana in Azure (such as an App Service or with Azure Virtual Machines) and have managed identity enabled on your VM.
This lets you securely authenticate data sources without manually configuring credentials via Azure AD App Registrations.
For details on Azure managed identities, refer to the [Azure documentation](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview).

**To enable managed identity for Grafana:**

1. Set the `managed_identity_enabled` flag in the `[azure]` section of the [Grafana server configuration][configure-grafana-azure].

   ```ini
   [azure]
   managed_identity_enabled = true
   ```

2. In the Azure Monitor data source configuration, set **Authentication** to **Managed Identity**.

   This hides the directory ID, application ID, and client secret fields, and the data source uses managed identity to authenticate to Azure Monitor Metrics and Logs, and Azure Resource Graph.

   {{< figure src="/media/docs/grafana/data-sources/screenshot-managed-identity-2.png" max-width="800px" class="docs-image--no-shadow" caption="Azure Monitor screenshot showing Managed Identity authentication" >}}

3. You can set the `managed_identity_client_id` field in the `[azure]` section of the [Grafana server configuration][configure-grafana-azure] to allow a user-assigned managed identity to be used instead of the default system-assigned identity.

```ini
[azure]
managed_identity_enabled = true
managed_identity_client_id = USER_ASSIGNED_IDENTITY_CLIENT_ID
```

### Configure Workload Identity

You can use workload identity to configure Azure Monitor in Grafana if you host Grafana in a Kubernetes environment, such as AKS, in conjunction with managed identities.
This lets you securely authenticate data sources without manually configuring credentials via Azure AD App Registrations.
For details on workload identity, refer to the [Azure workload identity documentation](https://azure.github.io/azure-workload-identity/docs/).

**To enable workload identity for Grafana:**

1. Set the `workload_identity_enabled` flag in the `[azure]` section of the [Grafana server configuration][configure-grafana-azure].

   ```ini
   [azure]
   workload_identity_enabled = true
   ```

2. In the Azure Monitor data source configuration, set **Authentication** to **Workload Identity**.

   This hides the directory ID, application ID, and client secret fields, and the data source uses workload identity to authenticate to Azure Monitor Metrics and Logs, and Azure Resource Graph.

   {{< figure src="/media/docs/grafana/data-sources/screenshot-workload-identity.png" max-width="800px" class="docs-image--no-shadow" caption="Azure Monitor screenshot showing Workload Identity authentication" >}}

3. There are additional configuration variables that can control the authentication method.`workload_identity_tenant_id` represents the Azure AD tenant that contains the managed identity, `workload_identity_client_id` represents the client ID of the managed identity if it differs from the default client ID, `workload_identity_token_file` represents the path to the token file. Refer to the [documentation](https://azure.github.io/azure-workload-identity/docs/) for more information on what values these variables should use, if any.

   ```ini
   [azure]
   workload_identity_enabled = true
   workload_identity_tenant_id = IDENTITY_TENANT_ID
   workload_identity_client_id = IDENTITY_CLIENT_ID
   workload_identity_token_file = TOKEN_FILE_PATH
   ```

## Query the data source

The Azure Monitor data source can query data from Azure Monitor Metrics and Logs, the Azure Resource Graph, and Application Insights Traces. Each source has its own specialized query editor.

For details, see the [query editor documentation]({{< relref "./query-editor" >}}).

## Use template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For details, see the [template variables documentation]({{< relref "./template-variables" >}}).

## Application Insights and Insights Analytics (removed)

Until Grafana v8.0, you could query the same Azure Application Insights data using Application Insights and Insights Analytics.

These queries were deprecated in Grafana v7.5. In Grafana v8.0, Application Insights and Insights Analytics were made read-only in favor of querying this data through Metrics and Logs. These query methods were completely removed in Grafana v9.0.

If you're upgrading from a Grafana version prior to v9.0 and relied on Application Insights and Analytics queries, refer to the [Grafana v9.0 documentation](/docs/grafana/v9.0/datasources/azuremonitor/deprecated-application-insights/) for help migrating these queries to Metrics and Logs queries.

{{% docs/reference %}}
[build-dashboards]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards"
[build-dashboards]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/build-dashboards"

[configure-grafana-azure]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/setup-grafana/configure-grafana#azure"
[configure-grafana-azure]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/setup-grafana/configure-grafana#azure"

[data-source-management]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"
[data-source-management]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/data-source-management"

[explore]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/explore"
[explore]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/explore"

[provisioning-data-sources]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/administration/provisioning#data-sources"
[provisioning-data-sources]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/administration/provisioning#data-sources"
{{% /docs/reference %}}
