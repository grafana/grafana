---
aliases:
  - /docs/grafana/latest/enterprise/saml/set-up-saml-with-okta/
description: This is a guide to set up SAML authentication with Okta in Grafana
keywords:
  - grafana
  - saml
  - documentation
  - saml-auth
  - enterprise
menuTitle: SAML authentication with Okta
title: Set up SAML authentication with Okta in Grafana
weight: 30
---

# Set up SAML with Okta

Grafana supports user authentication through Okta, which is useful when you want your users to access Grafana using single sign on. This guide will follow you through the steps of configuring SAML authentication in Grafana with [Okta](https://okta.com/). You need to be an admin in your Okta organization to access Admin Console and create SAML integration. You also need permissions to edit Grafana config file and restart Grafana server.

## Before you begin

- To configure SAML integration with Okta, create integration inside the Okta organization first. [Add integration in Okta](https://help.okta.com/en/prod/Content/Topics/Apps/apps-overview-add-apps.htm)
- Ensure you have permission to administer SAML authentication. For more information about permissions, refer to [About users and permissions]({{< relref "../../administration/manage-users-and-permissions/about-users-and-permissions.md#" >}}).

**To set up SAML with Okta:**

1. Log in to the [Okta portal](https://login.okta.com/).
1. Go to the Admin Console in your Okta organization by clicking **Admin** in the upper-right corner. If you are in the Developer Console, then click **Developer Console** in the upper-left corner and then click **Classic UI** to switch over to the Admin Console.
1. In the Admin Console, navigate to **Applications** > **Applications**.
1. Click **Add Application**.
1. Click **Create New App** to start the Application Integration Wizard.
1. Choose **Web** as a platform.
1. Select **SAML 2.0** in the Sign on method section.
1. Click **Create**.
1. On the **General Settings** tab, enter a name for your Grafana integration. You can also upload a logo.
1. On the **Configure SAML** tab, enter the SAML information related to your Grafana instance:

   - In the **Single sign on URL** field, use the `/saml/acs` endpoint URL of your Grafana instance, for example, `https://grafana.example.com/saml/acs`.
   - In the **Audience URI (SP Entity ID)** field, use the `/saml/metadata` endpoint URL, for example, `https://grafana.example.com/saml/metadata`.
   - Leave the default values for **Name ID format** and **Application username**.
   - In the **ATTRIBUTE STATEMENTS (OPTIONAL)** section, enter the SAML attributes to be shared with Grafana, for example:

     | Attribute name (in Grafana) | Value (in Okta profile)                |
     | --------------------------- | -------------------------------------- |
     | Login                       | `user.login`                           |
     | Email                       | `user.email`                           |
     | DisplayName                 | `user.firstName + " " + user.lastName` |

   - In the **GROUP ATTRIBUTE STATEMENTS (OPTIONAL)** section, enter a group attribute name (for example, `Group`) and set filter to `Matches regex .*` to return all user groups.

1. Click **Next**.
1. On the final Feedback tab, fill out the form and then click **Finish**.
