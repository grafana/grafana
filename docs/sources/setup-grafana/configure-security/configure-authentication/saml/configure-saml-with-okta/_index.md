---
description: Learn how to configure SAML authentication in Grafana's UI.
labels:
  products:
    - cloud
    - enterprise
menuTitle: Configure SAML with Okta
title: Configure SAML authentication with Okta
weight: 580
---

# Configure SAML Okta

Grafana supports user authentication through Okta, which is useful when you want your users to access Grafana using single sign on. This guide will follow you through the steps of configuring SAML authentication in Grafana with [Okta](https://okta.com/). You need to be an admin in your Okta organization to access Admin Console and create SAML integration. You also need permissions to edit Grafana configuration file and restart Grafana server.

## Before you begin

- To configure SAML integration with Okta, create an app integration inside the Okta organization first. [Add app integration in Okta](https://help.okta.com/en/prod/Content/Topics/Apps/apps-overview-add-apps.htm)
- Ensure you have permission to administer SAML authentication. For more information about roles and permissions in Grafana, refer to [Roles and permissions](/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/).

## Set up SAML with Okta

1. Log in to the [Okta portal](https://login.okta.com/).
1. Go to the Admin Console in your Okta organization by clicking **Admin** in the upper-right corner. If you are in the Developer Console, then click **Developer Console** in the upper-left corner and then click **Classic UI** to switch over to the Admin Console.
1. In the Admin Console, navigate to **Applications** > **Applications**.
1. Click **Create App Integration** to start the Application Integration Wizard.
1. Choose **SAML 2.0** as the **Sign-in method**.
1. Click **Create**.
1. On the **General Settings** tab, enter a name for your Grafana integration. You can also upload a logo.
1. On the **Configure SAML** tab, enter the SAML information related to your Grafana instance:
   - In the **Single sign on URL** field, use the `/saml/acs` endpoint URL of your Grafana instance, for example, `https://grafana.example.com/saml/acs`.
   - In the **Audience URI (SP Entity ID)** field, use the `/saml/metadata` endpoint URL, by default it is the `/saml/metadata` endpoint of your Grafana instance (for example `https://example.grafana.com/saml/metadata`). This could be configured differently, but the value here must match the `entity_id` setting of the SAML settings of Grafana.
   - Leave the default values for **Name ID format** and **Application username**.
     {{< admonition type="note" >}}
     If you plan to enable SAML Single Logout, consider setting the **Name ID format** to `EmailAddress` or `Persistent`. This must match the `name_id_format` setting of the Grafana instance.
     {{< /admonition >}}
   - In the **ATTRIBUTE STATEMENTS (REQUIRED)** section, enter the SAML attributes to be shared with Grafana. The attribute names in Okta need to match exactly what is defined within Grafana, for example:

     | Attribute name (in Grafana) | Name and value (in Okta profile)                     | Grafana configuration (under `auth.saml`) |
     | --------------------------- | ---------------------------------------------------- | ----------------------------------------- |
     | Login                       | Login - `user.login`                                 | `assertion_attribute_login = Login`       |
     | Email                       | Email - `user.email`                                 | `assertion_attribute_email = Email`       |
     | DisplayName                 | DisplayName - `user.firstName + " " + user.lastName` | `assertion_attribute_name = DisplayName`  |

   - In the **GROUP ATTRIBUTE STATEMENTS (OPTIONAL)** section, enter a group attribute name (for example, `Group`, ensure it matches the `asssertion_attribute_groups` setting in Grafana) and set filter to `Matches regex .*` to return all user groups.

1. Click **Next**.
1. On the final Feedback tab, fill out the form and then click **Finish**.

## Configure SAML assertions when using SCIM provisioning

In order to verify the logged in user is the same user that was provisioned through Okta, you need to include the same `externalId` in the SAML assertion by mapping the SAML assertion `assertion_attribute_external_id`.

1. Open your Okta application.
1. Select the SAML single sign-on configuration.
1. Edit the `Attributes & Claims` section.
1. Add a new claim with the following settings:
   - Name: `userUID`

### Example configuration

| Attribute name (in Grafana) | Name and value (in Okta profile)           | Grafana default configuration (under `auth.saml`) |
| --------------------------- | ------------------------------------------ | ------------------------------------------------- |
| userUID                     | userUID - `user.getInternalProperty("id")` | `assertion_attribute_login = userUID`             |
