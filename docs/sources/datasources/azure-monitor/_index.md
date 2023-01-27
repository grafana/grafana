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
menuTitle: Azure Monitor
title: Azure Monitor data source
weight: 300
---

# Azure Monitor data source

Grafana ships with built-in support for Azure Monitor, the Azure service to maximize the availability and performance of applications and services in the Azure Cloud.
This topic explains configuring and querying specific to the Azure Monitor data source.

For instructions on how to add a data source to Grafana, refer to the [administration documentation]({{< relref "../../administration/data-source-management" >}}).
Only users with the organization administrator role can add data sources.

Once you've added the Azure Monitor data source, you can [configure it]({{< relref "#configure-the-data-source" >}}) so that your Grafana instance's users can create queries in its [query editor]({{< relref "./query-editor" >}}) when they [build dashboards]({{< relref "../../dashboards/build-dashboards" >}}) and use [Explore]({{< relref "../../explore" >}}).

The Azure Monitor data source supports visualizing data from three Azure services:

- **Azure Monitor Metrics:** Collect numeric data from resources in your Azure account.
- **Azure Monitor Logs:** Collect log and performance data from your Azure account, and query using the Kusto Query Language (KQL).
- **Azure Resource Graph:** Query your Azure resources across subscriptions.

## Configure the data source

**To access the data source configuration page:**

1. Hover the cursor over the **Configuration** (gear) icon.
1. Select **Data Sources**.
1. Select the Azure Monitor data source.

### Configure Azure Active Directory (AD) authentication

You must create an app registration and service principal in Azure AD to authenticate the data source.
For configuration details, refer to the [Azure documentation for service principals](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal#get-tenant-and-app-id-values-for-signing-in).

The app registration you create must have the `Reader` role assigned on the subscription.
For more information, refer to [Azure documentation for role assignments](https://docs.microsoft.com/en-us/azure/role-based-access-control/role-assignments-portal?tabs=current).

If you host Grafana in Azure, such as in App Service or Azure Virtual Machines, you can configure the Azure Monitor data source to use Managed Identity for secure authentication without entering credentials into Grafana.
For details, refer to [Configuring using Managed Identity]({{< relref "#configuring-using-managed-identity" >}}).

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
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana]({{< relref "../../administration/provisioning/#data-sources" >}}).

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

#### Supported cloud names

| Azure Cloud                          | `cloudName` Value          |
| ------------------------------------ | -------------------------- |
| **Microsoft Azure public cloud**     | `azuremonitor` (_Default_) |
| **Microsoft Chinese national cloud** | `chinaazuremonitor`        |
| **US Government cloud**              | `govazuremonitor`          |

### Configure Managed Identity

If you host Grafana in Azure, such as an App Service or with Azure Virtual Machines, and have managed identity enabled on your VM, you can use managed identity to configure Azure Monitor in Grafana.
This lets you securely authenticate data sources without manually configuring credentials via Azure AD App Registrations for each.
For details on Azure managed identities, refer to the [Azure documentation](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview).

**To enable managed identity for Grafana:**

1. Set the `managed_identity_enabled` flag in the `[azure]` section of the [Grafana server configuration]({{< relref "../../setup-grafana/configure-grafana/#azure" >}}).

   ```ini
   [azure]
   managed_identity_enabled = true
   ```

2. In the Azure Monitor data source configuration, set **Authentication** to **Managed Identity**.

   This hides the directory ID, application ID, and client secret fields, and the data source uses managed identity to authenticate to Azure Monitor Metrics and Logs, and Azure Resource Graph.

   {{< figure src="/static/img/docs/azure-monitor/managed-identity.png" max-width="800px" class="docs-image--no-shadow" caption="Azure Monitor Metrics screenshot showing Dimensions" >}}

## Query the data source

The Azure Monitor data source can query data from Azure Monitor Metrics and Logs, and the Azure Resource Graph, each with its own specialized query editor.

For details, see the [query editor documentation]({{< relref "./query-editor/" >}}).

## Use template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For details, see the [template variables documentation]({{< relref "./template-variables/" >}}).

## Application Insights and Insights Analytics (removed))

Until Grafana v8.0, you could query the same Azure Application Insights data using Application Insights and Insights Analytics.

These queries were deprecated in Grafana v7.5. In Grafana v8.0, Application Insights and Insights Analytics were made read-only in favor of querying this data through Metrics and Logs. These query methods were completely removed in Grafana v9.0.

If you're upgrading from a Grafana version prior to v9.0 and relied on Application Insights and Analytics queries, refer to the [Grafana v9.0 documentation](/docs/grafana/v9.0/datasources/azuremonitor/deprecated-application-insights/) for help migrating these queries to Metrics and Logs queries.
