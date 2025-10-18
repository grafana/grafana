---
description: Multiple providers with Keycloak
keywords:
  - grafana
  - keycloak
  - configuration
  - documentation
  - oauth
  - google
  - azure
  - okta
labels:
  products:
    - cloud
    - oss
menuTitle: Multiple providers with Keycloak
title: Multiple providers with Keycloak in Grafana
weight: 1350
---

# Multiple providers with Keycloak in Grafana

While Grafana offers a variety of authentication providers, you can only configure one provider of one type at a time. However, you can configure multiple providers of the same type with the help of Keycloak.

This guide explains how to set up multiple providers of the same type with Keycloak as an authentication provider in Grafana.

The idea is to set up multiple OIDC providers in Keycloak with different tenants and configure Grafana to use the same Keycloak instance as the authentication provider.

## Azure AD configuration

For Azure AD, repeat the following steps for each tenant you want to set up in Keycloak.

### Overview

1. Register your application in Azure AD.
1. Give access to the application to the users in the tenant.
1. Create credentials for the application.
1. Configure the application in Keycloak.
1. Configure Grafana to use Keycloak.

#### Register your application in Azure AD

Registering an application in Azure AD is a one-time process. You can follow the steps in the [Azure AD documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app) to register your application.

1. Go to the Azure portal and ensure you are using the correct tenant also known as directory.
1. Search for **App Registrations** and click on **New registration**.
1. Fill in the details for the application and click **Register**. You'll be redirected to the application's overview page.

#### Give access to the application to the users in the tenant

Assigning the correct access to users ensures only intended users or groups have access to the application.

1. Search for **Enterprise Applications** and look for the application you just created in the previous step.
1. Under the **Manage** section, click on **Users and groups**.
1. Click on **Add user/group** and add the users or groups that should have access to the application.

#### Create credentials for the application

To authenticate with Azure AD, the Keycloak application needs a client ID and client secret.

1. Search for **App Registrations** and look for the application ypu just created.
1. Click on **Certificates & Secrets**.
1. Click on **New client secret** and fill in the details. Make sure to copy the secret value as it will not be shown again.

#### Configure the application in Keycloak

1. Go to the Keycloak admin console.
1. Go to the Realm where you want to configure the Azure AD tenant.
1. Go to the Identity Providers section and click on **Add provider**.
1. Select **OpenID Connect v1.0**.
   1. Select a unique **Alias** and **Display name**.
   1. Copy the **Redirect URI**.
   1. Back in Azure Portal, go to the application's **Authentication** section.
   1. Add a **new platform** and select **Web**.
   1. Paste the **Redirect URI** from Keycloak.
   1. Save the changes.
   1. Navigate to the Azure Application overview and look for the **Endpoints** tab.
   1. Copy the **OpenID Connect metadata document** URL.
   1. Head back to Keycloak and paste the URL in the **Discovery endpoint** field.
   1. Navigate to the Azure application overview and look for the **Application (client) ID**.
   1. Copy the **Application ID** and paste it in the **Client ID** field in Keycloak.
   1. Paste the client secret you created in the previous step in the **Client secret** field.
   1. Click Add.

{{< admonition type="note" >}}
Up to this point, you have created an App Registration in Azure AD, assigned users to the application, created credentials for the application, and configured the application in Keycloak. In the Keycloak Client's section, the client with ID `account` Home URL can be used to test the configuration. This will open a new tab where you can login into the correct Keycloak realm with the Azure AD tenant you just configured.
{{< /admonition >}}

Repeat this steps, for every Azure AD tenant you want to configure in Keycloak.

#### Configure Grafana to use Keycloak

Now that the Azure AD tenants are configured in Keycloak, you can configure Grafana to use Keycloak as the authentication provider.

Refer to the [Keycloak documentation](https://grafana.com/docs/grafana/latest/auth/keycloak/) to configure Grafana to use Keycloak as the authentication provider.
