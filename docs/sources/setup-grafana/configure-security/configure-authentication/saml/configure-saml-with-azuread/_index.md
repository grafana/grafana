---
description: Learn how to configure SAML authentication in Grafana's UI.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Configure SAML with Azure AD
title: Configure SAML authentication with Azure AD
weight: 510
---

## Set up SAML with Azure AD

Grafana supports user authentication through Azure AD, which is useful when you want users to access Grafana using single sign-on. This topic shows you how to configure SAML authentication in Grafana with [Azure AD](https://azure.microsoft.com/en-us/services/active-directory/).

**Before you begin**

Ensure you have permission to administer SAML authentication. For more information about roles and permissions in Grafana, refer to [Roles and permissions](/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/).

Learn the [limitations of Azure AD SAML] (https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference#groups-overage-claim) integration.

Configure SAML integration with Azure AD, [creating an Enterprise Application](#add-microsoft-entra-saml-toolkit-from-the-gallery) inside the Azure AD organization first and then [enable single sign-on](#configure-the-saml-toolkit-application-endpoints).

If you have users that belong to more than 150 groups, configure a registered application to provide an Azure Graph API to retrieve the groups. Refer to [Setup Azure AD Graph API applications](#configure-a-graph-api-application-in-azure-ad).

### Generate self-signed certificates

Azure AD requires a certificate to sign the SAML requests. You can generate a self-signed certificate using the following command:

```sh
$ openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

This will generate a `key.pem` and `cert.pem` file that you can use for the `private_key_path` and `certificate_path` configuration options.

### Add Microsoft Entra SAML Toolkit from the gallery

> Taken from https://learn.microsoft.com/en-us/entra/identity/saas-apps/saml-toolkit-tutorial#add-microsoft-entra-saml-toolkit-from-the-gallery

1. Go to the [Azure portal](https://portal.azure.com/#home) and sign in with your Azure AD account.
1. Search for **Enterprise Applications**.
1. In the **Enterprise applications** pane, select **New application**.
1. In the search box, enter **SAML Toolkit**, and then select the **Microsoft Entra SAML Toolkit** from the results panel.
1. Add a descriptive name and select **Create**.

### Configure the SAML Toolkit application endpoints

In order to validate Azure AD users with Grafana, you need to configure the SAML Toolkit application endpoints by creating a new SAML integration in the Azure AD organization.

> For the following configuration, we will use `https://localhost` as the Grafana URL. Replace it with your Grafana URL.

1. In the **SAML Toolkit application**, select **Set up single sign-on**.
1. In the **Single sign-on** pane, select **SAML**.
1. In the Set up **Single Sign-On with SAML** pane, select the pencil icon for **Basic SAML Configuration** to edit the settings.
1. In the **Basic SAML Configuration** pane, click on the **Edit** button and update the following fields:
   - In the **Identifier (Entity ID)** field, enter `https://localhost/saml/metadata`.
   - In the **Reply URL (Assertion Consumer Service URL)** field, enter `https://localhost/saml/acs`.
   - In the **Sign on URL** field, enter `https://localhost`.
   - In the **Relay State** field, enter `https://localhost`.
   - In the **Logout URL** field, enter `https://localhost/saml/slo`.
1. Select **Save**.
1. At the **SAML Certificate** section, copy the **App Federation Metadata Url**.
   - Use this URL in the `idp_metadata_url` field in the `custom.ini` file.

### Configure a Graph API application in Azure AD

While an Azure AD tenant can be configured in Grafana via SAML, some additional information is only accessible via the Graph API. To retrieve this information, create a new application in Azure AD and grant it the necessary permissions.

> [Azure AD SAML limitations](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference#groups-overage-claim)

> For the following configuration, the URL `https://localhost` will be used as the Grafana URL. Replace it with your Grafana instance URL.

#### Create a new Application registration

This app registration will be used as a Service Account to retrieve more information about the user from the Azure AD.

1. Go to the [Azure portal](https://portal.azure.com/#home) and sign in with your Azure AD account.
1. In the left-hand navigation pane, select the Azure Active Directory service, and then select **App registrations**.
1. Click the **New registration** button.
1. In the **Register an application** pane, enter a name for the application.
1. In the **Supported account types** section, select the account types that can use the application.
1. In the **Redirect URI** section, select Web and enter `https://localhost/login/azuread`.
1. Click the **Register** button.

#### Set up permissions for the application

1. In the overview pane, look for **API permissions** section and select **Add a permission**.
1. In the **Request API permissions** pane, select **Microsoft Graph**, and click **Application permissions**.
1. In the **Select permissions** pane, under the **GroupMember** section, select **GroupMember.Read.All**.
1. In the **Select permissions** pane, under the **User** section, select **User.Read.All**.
1. Click the **Add permissions** button at the bottom of the page.
1. In the **Request API permissions** pane, select **Microsoft Graph**, and click **Delegated permissions**.
1. In the **Select permissions** pane, under the **User** section, select **User.Read**.
1. Click the **Add permissions** button at the bottom of the page.
1. In the **API permissions** section, select **Grant admin consent for <your-organization>**.

The following table shows what the permissions look like from the Azure AD portal:

| Permissions name | Type        | Admin consent required | Status  |
| ---------------- | ----------- | ---------------------- | ------- |
| `Group.Read.All` | Application | Yes                    | Granted |
| `User.Read`      | Delegated   | No                     | Granted |
| `User.Read.All`  | Application | Yes                    | Granted |

{{< figure src="/media/docs/grafana/saml/graph-api-app-permissions.png" caption="Screen shot of the permissions listed in Azure AD for the App registration" >}}

#### Generate a client secret

1. In the **Overview** pane, select **Certificates & secrets**.
1. Select **New client secret**.
1. In the **Add a client secret** pane, enter a description for the secret.
1. Set the expiration date for the secret.
1. Select **Add**.
1. Copy the value of the secret. This value is used in the `client_secret` field in the `custom.ini` file.