---
aliases:
  - ../data-sources/azure-monitor/
  - ../features/datasources/azuremonitor/
  - azuremonitor/
  - azuremonitor/deprecated-application-insights/
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
refs:
  configure-grafana-feature-toggles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#feature_toggles
  provisioning-data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#data-sources
  explore:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
  configure-grafana-azure-auth:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/azuread/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/azuread/
  build-dashboards:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/
  configure-grafana-azure:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#azure
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#azure
  data-source-management:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/
  configure-grafana-azure-auth-scopes:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/azuread/#enable-azure-ad-oauth-in-grafana
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/azuread/#enable-azure-ad-oauth-in-grafana
  data-sources:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/
  private-data-source-connect:
    - pattern: /docs/grafana/
      destination:  docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
    - pattern: /docs/grafana-cloud/
      destination:  docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/
  configure-pdc:
    - pattern: /docs/grafana/
      destination:  /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/configure-pdc/#configure-grafana-private-data-source-connect-pdc

---

# Configure the Azure Monitor data source

This document provides instructions for configuring the Azure Monitor data source and explains available configuration options. For general information on adding and managing data sources, refer to [Grafana data sources](ref:data-sources) and [Data source management](ref:data-source-management).

## Before you begin

- Grafana comes with a built-in Azure Monitor data source plugin, eliminating the need to install a plugin.

- You must have the `Organization administrator` role to configure the Postgres data source.
  Organization administrators can also [configure the data source via YAML](#provision-the-data-source) with the Grafana provisioning system.

- Familiarize yourself with your Azure Monitor security configuration and gather any necessary security certificates and client keys.

- You must create an app registration and service principal in Azure AD to authenticate the data source.

## Add the Azure Monitor data source

To add the Azure Monitor data source, complete the following steps:

1. Click **Connections** in the left-side menu.
1. Click **Add new connection**
1. Type `Azure Monitor` in the search bar.
1. Select **Azure Monitor** under data source.
1. Click **Add new data source** in the upper right.

Grafana takes you to the **Settings** tab, where you will set up your Azure Monitor configuration.

## Configure the data source in the UI

The following are configuration options for the Azure Monitor data source:

| **Setting** | **Description** |
|-------------|----------------|
| **Name**    | The data source name. Sets the name you use to refer to the data source in panels and queries. Examples: `logs-monitor-1`. |
| **Default** | Toggle to select as the default name in dashboard panels. When you go to a dashboard panel, this will be the default selected data source. |

There are four authentication methods for teh Azure Monitor data source. Select one from the drop-down. `Managed Identity` is the default.

**Managed Identity:** You can use managed identity to configure Azure Monitor in Grafana if you host Grafana in Azure (such as an App Service or with Azure Virtual Machines) and have managed identity enabled on your VM. This lets you securely authenticate data sources without manually configuring credentials via Azure AD App Registrations. For details on Azure managed identities, refer to the Azure documentation.

<!-- **Default Subscription:** Click **Load Subscriptions** to populate the drop-down with available subscriptions. Select the subscription that contains the Azure resources you want to monitor. This becomes the primary subscription for querying metrics, logs, and other monitoring data. For additional information refer to [Configure Managed Identity](#configure-managed-identity).

| **Enable Basic Logs**       | Allows the data source to execute queries against [Basic Logs tables](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/basic-logs-query?tabs=portal-1) in supported Log Analytics Workspaces. These queries may incur additional costs. -->

| Setting                 | Description |
|--------------------------|-------------|
| **Default Subscription** | Click **Load Subscriptions** to populate the drop-down with available subscriptions. Select the subscription that contains the Azure resources you want to monitor. This becomes the primary subscription for querying metrics, logs, and other monitoring data. For additional information refer to [Configure Managed Identity](#configure-managed-identity). |
| **Enable Basic Logs**    | Allows the data source to execute queries against [Basic Logs tables](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/basic-logs-query?tabs=portal-1) in supported Log Analytics Workspaces. These queries may incur additional costs. |

For additional detail refer to [Configure Managed Identity](#configure-managed-identity).


**Current User:** Current User authentication uses the individual Grafana user's Azure AD, which provides user-level access control but requires fallback credentials for automated features.

| Setting | Description |
|---------|-------------|
| **Authentication** | Set to "Current User" to use the logged-in Grafana user's Azure credentials for authentication. This passes the current user's identity to Azure services when querying data. |
| **Default Subscription** | Select which Azure subscription to query by default. Click "Load Subscriptions" to populate the drop-down with subscriptions accessible to the current user. |
| **Enable Basic Logs** | Toggle to allow querying Azure Monitor Basic Logs tables. These are lower-cost logs with some query limitations, and enabling this incurs per-query costs when querying basic log tables in dashboard panels. |
| **Fallback Service Credentials** | Optional configuration to provide app registration credentials as a fallback. User-based authentication doesn't support certain Grafana features that make requests without user context (like alerting). Enable fallback credentials to ensure these features continue to function. Note that features using fallback credentials will be restricted to the access level of those credentials rather than the user's permissions. |

**App Registration:** Use a service principal (an Azure AD application) to authenticate.

<!-- Azure Cloud - Specifies which Azure environment you're connecting to. "Azure" is the standard public Azure cloud. Other options would include Azure Government, Azure China, etc.

Directory (tenant) ID - The unique identifier for your Azure Active Directory (Azure AD) tenant. This is the GUID that identifies your organization's Azure AD instance.

Application (client) ID - The unique identifier for the Azure AD app registration (service principal) you created. This identifies which application is requesting access to Azure resources.

Client Secret - The password/secret key associated with your app registration. This proves that the request is coming from the authorized application. This should be kept secure and rotated periodically.

Default Subscription - Lets you select which Azure subscription to query by default. After entering the credentials above, you can click "Load Subscriptions" to populate this drop-down with subscriptions your service principal has access to.

Enable Basic Logs - Toggle to allow querying Azure Monitor Basic Logs tables. These are lower-cost logs with some query limitations, and enabling this incurs per-query costs when querying basic log tables in dashboard panels. -->

| Setting | Description |
|---------|-------------|
| **Azure Cloud** | Specifies which Azure environment you're connecting to. "Azure" is the standard public Azure cloud. Other options would include Azure Government, Azure China, etc. |
| **Directory (tenant) ID** | The unique identifier for your Azure Active Directory (Azure AD) tenant. This is the GUID that identifies your organization's Azure AD instance. |
| **Application (client) ID** | The unique identifier for the Azure AD app registration (service principal) you created. This identifies which application is requesting access to Azure resources. |
| **Client Secret** | The password/secret key associated with your app registration. This proves that the request is coming from the authorized application. This should be kept secure and rotated periodically. |
| **Default Subscription** | Lets you select which Azure subscription to query by default. After entering your credentials, click **Load Subscriptions** to populate this drop-down with subscriptions your service principal has access to. |
| **Enable Basic Logs** | Toggle to allow querying Azure Monitor Basic Logs tables. These are lower-cost logs with some query limitations, and enabling this incurs per-query costs when querying basic log tables in dashboard panels. |

**Workload Identity:** Azure's modern authentication method for applications and services running in Kubernetes environments. It allows pods/workloads to authenticate to Azure services using federated identity credentials without needing to manage secrets. Set to "Workload Identity" to use Azure Workload Identity for authentication. This is designed for Grafana instances running in Azure Kubernetes Service (AKS) or other Kubernetes environments configured with workload identity federation. |

| Setting | Description |
|---------|-------------|
| **Default Subscription** | Select which Azure subscription to query by default. Click "Load Subscriptions" to populate the dropdown with subscriptions accessible to the workload identity. |
| **Enable Basic Logs** | Toggle to allow querying Azure Monitor Basic Logs tables. These are lower-cost logs with some query limitations, and enabling this incurs per-query costs when querying basic log tables in dashboard panels. |

**Private data source connect** - _Only for Grafana Cloud users._

Private data source connect, or PDC, allows you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. Click the drop-down to locate the URL for PDC. For more information regarding Grafana PDC refer to [Private data source connect (PDC)](ref:private-data-source-connect) and [Configure Grafana private data source connect (PDC)](ref:configure-pdc) for instructions on setting up a PDC connection.

Click **Manage private data source connect** to open your PDC connection page and view your configuration details.

After configuring your MSSQL data source options, click **Save & test** at the bottom to test the connection. You should see a confirmation dialog box that says:

**Database Connection OK**



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
| **Enable Basic Logs**       | Allows this data source to execute queries against [Basic Logs tables](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/basic-logs-query?tabs=portal-1) in supported Log Analytics Workspaces. These queries may incur additional costs.                                                    |

### Provision the data source

You can define and configure the data source in YAML files as part of Grafana's provisioning system.
For more information about provisioning, and for available configuration options, refer to [Provisioning Grafana](ref:provisioning-data-sources).

Examples:


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

**Current User:**

{{< admonition type="note" >}}
The `oauthPassThru` property is required for current user authentication to function.
Additionally, `disableGrafanaCache` is necessary to prevent the data source returning cached responses for resources users don't have access to.
{{< /admonition >}}

```yaml
apiVersion: 1 # config file version

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

#### Supported cloud names

| Azure Cloud                          | `cloudName` Value          |
| ------------------------------------ | -------------------------- |
| **Microsoft Azure public cloud**     | `azuremonitor` (_Default_) |
| **Microsoft Chinese national cloud** | `chinaazuremonitor`        |
| **US Government cloud**              | `govazuremonitor`          |

{{< admonition type="note" >}}
Cloud names for current user authentication differ to the `cloudName` values in the preceding table.
The public cloud name is `AzureCloud`, the Chinese national cloud name is `AzureChinaCloud`, and the US Government cloud name is `AzureUSGovernment`.
{{< /admonition >}}

### Configure Managed Identity

{{< admonition type="note" >}}
Managed Identity is available only in [Azure Managed Grafana](https://azure.microsoft.com/en-us/products/managed-grafana) or Grafana OSS/Enterprise when deployed in Azure. It is not available in Grafana Cloud.
{{< /admonition >}}

You can use managed identity to configure Azure Monitor in Grafana if you host Grafana in Azure (such as an App Service or with Azure Virtual Machines) and have managed identity enabled on your VM.
This lets you securely authenticate data sources without manually configuring credentials via Azure AD App Registrations.
For details on Azure managed identities, refer to the [Azure documentation](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview).

**To enable managed identity for Grafana:**

1. Set the `managed_identity_enabled` flag in the `[azure]` section of the [Grafana server configuration](ref:configure-grafana-azure).

   ```ini
   [azure]
   managed_identity_enabled = true
   ```

2. In the Azure Monitor data source configuration, set **Authentication** to **Managed Identity**.

   This hides the directory ID, application ID, and client secret fields, and the data source uses managed identity to authenticate to Azure Monitor Metrics and Logs, and Azure Resource Graph.

   {{< figure src="/media/docs/grafana/data-sources/screenshot-managed-identity-2.png" max-width="800px" class="docs-image--no-shadow" caption="Azure Monitor screenshot showing Managed Identity authentication" >}}

3. You can set the `managed_identity_client_id` field in the `[azure]` section of the [Grafana server configuration](ref:configure-grafana-azure) to allow a user-assigned managed identity to be used instead of the default system-assigned identity.

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

1. Set the `workload_identity_enabled` flag in the `[azure]` section of the [Grafana server configuration](ref:configure-grafana-azure).

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

### Configure Current User authentication

{{< admonition type="note" >}}
Current user authentication is an [experimental feature](/docs/release-life-cycle). Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided. Contact Grafana Support to enable this feature in Grafana Cloud. Aspects of Grafana may not work as expected when using this authentication method.
{{< /admonition >}}

If your Grafana instance is configured with Azure Entra (formerly Active Directory) authentication for login, this authentication method can be used to forward the currently logged in user's credentials to the data source. The users credentials will then be used when requesting data from the data source. For details on how to configure your Grafana instance using Azure Entra refer to the [documentation](ref:configure-grafana-azure-auth).

{{< admonition type="note" >}}
Additional configuration is required to ensure that the App Registration used to login a user via Azure provides an access token with the permissions required by the data source.

The App Registration must be configured to issue both **Access Tokens** and **ID Tokens**.

1. In the Azure Portal, open the App Registration that requires configuration.
2. Select **Authentication** in the side menu.
3. Under **Implicit grant and hybrid flows** check both the **Access tokens** and **ID tokens** boxes.
4. Save the changes to ensure the App Registration is updated.

The App Registration must also be configured with additional **API Permissions** to provide authenticated users with access to the APIs utilised by the data source.

1. In the Azure Portal, open the App Registration that requires configuration.
1. Select **API Permissions** in the side menu.
1. Ensure the `openid`, `profile`, `email`, and `offline_access` permissions are present under the **Microsoft Graph** section. If not, they must be added.
1. Select **Add a permission** and choose the following permissions. They must be added individually. Refer to the [Azure documentation](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-access-web-apis) for more information.
   - Select **Azure Service Management** > **Delegated permissions** > `user_impersonation` > **Add permissions**
   - Select **APIs my organization uses** > Search for **Log Analytics API** and select it > **Delegated permissions** > `Date.Read` > **Add permissions**

Once all permissions have been added, the Azure authentication section in Grafana must be updated. The `scopes` section must be updated to include the `.default` scope to ensure that a token with access to all APIs declared on the App Registration is requested by Grafana. Once updated the scopes value should equal: `.default openid email profile`.
{{< /admonition >}}

This method of authentication doesn't inherently support all backend functionality as a user's credentials won't be in scope.
Affected functionality includes alerting, reporting, and recorded queries.
In order to support backend queries when using a data source configured with current user authentication, you can configure service credentials.
Also, note that query and resource caching is disabled by default for data sources using current user authentication.

{{< admonition type="note" >}}
To configure fallback service credentials the [feature toggle](ref:configure-grafana-feature-toggles) `idForwarding` must be set to `true` and `user_identity_fallback_credentials_enabled` must be enabled in the [Azure configuration section](ref:configure-grafana-azure) (enabled by default when `user_identity_enabled` is set to `true`).
{{< /admonition >}}

Permissions for fallback credentials may need to be broad to appropriately support backend functionality.
For example, an alerting query created by a user is dependent on their permissions.
If a user tries to create an alert for a resource that the fallback credentials can't access, the alert will fail.

**To enable current user authentication for Grafana:**

1. Set the `user_identity_enabled` flag in the `[azure]` section of the [Grafana server configuration](ref:configure-grafana-azure).
   By default this will also enable fallback service credentials.
   If you want to disable service credentials at the instance level set `user_identity_fallback_credentials_enabled` to false.

   ```ini
   [azure]
   user_identity_enabled = true
   ```

1. In the Azure Monitor data source configuration, set **Authentication** to **Current User**.
   If fallback service credentials are enabled at the instance level, an additional configuration section is visible that you can use to enable or disable using service credentials for this data source.
   {{< figure src="/media/docs/grafana/data-sources/screenshot-current-user.png" max-width="800px" class="docs-image--no-shadow" caption="Azure Monitor screenshot showing Current User authentication" >}}

1. If you want backend functionality to work with this data source, enable service credentials and configure the data source using the most applicable credentials for your circumstances.
