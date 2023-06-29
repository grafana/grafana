---
description: Learn how to configure SAML authentication in Grafana's UI.
menuTitle: SAML user interface
title: Configure SAML authentication using the Grafana user interface
weight: 600
---

# Configure SAML authentication using the Grafana user interface

{{% admonition type="note" %}}
Available in [Grafana Enterprise]({{< relref "../../../../introduction/grafana-enterprise" >}}) version 10.0 and later, and [Grafana Cloud Pro and Advanced](/docs/grafana-cloud/).
{{% /admonition %}}

You can configure SAML authentication in Grafana through the user interface (UI) or the Grafana configuration file. For instructions on how to set up SAML using the Grafana configuration file, refer to [Configure SAML authentication using the configuration file]({{< relref "../saml" >}}).

The Grafana SAML UI provides the following advantages over configuring SAML in the Grafana configuration file:

- It is accessible by Grafana Cloud users
- SAML UI carries out input validation and provides useful feedback on the correctness of the configuration, making SAML setup easier
- It doesn't require Grafana to be restarted after a configuration update
- Access to the SAML UI only requires access to authentication settings, so it can be used by users with limited access to Grafana's configuration

{{% admonition type="note" %}}
Any configuration changes made through the Grafana user interface (UI) will take precedence over settings specified in the Grafana configuration file or through environment variables. This means that if you modify any configuration settings in the UI, they will override any corresponding settings set via environment variables or defined in the configuration file. For more information on how Grafana determines the order of precedence for its settings, please refer to the [Settings update at runtime]({{< relref "../../../configure-grafana/settings-updates-at-runtime" >}}).
{{% /admonition %}}

{{% admonition type="note" %}}
Disabling the UI does not affect any configuration settings that were previously set up through the UI. Those settings will continue to function as intended even with the UI disabled.
{{% /admonition %}}

## Before you begin

To follow this guide, you need:

- Knowledge of SAML authentication. Refer to [SAML authentication in Grafana]({{< relref "../saml" >}}) for an overview of Grafana's SAML integration.
- Permissions `settings:read` and `settings:write` with scope `settings:auth.saml:*` that allow you to read and update SAML authentication settings.

  These permissions are granted by `fixed:authentication.config:writer` role.
  By default, this role is granted to Grafana server administrator in self-hosted instances and to Organization admins in Grafana Cloud instances.

- Grafana instance running Grafana version 10.0 or later with [Grafana Enterprise]({{< relref "../../../../introduction/grafana-enterprise" >}}) or [Grafana Cloud Pro or Advanced](/docs/grafana-cloud/) license.

## Steps

Follow these steps to configure and enable SAML integration:

1. Sign in to Grafana and navigate to **Administration > Authentication > Configure SAML**.
1. Complete the **General settings** fields.

   For assistance, consult the following table for additional guidance about certain fields:

| Field                                 | Description                                                                                                                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Allow signup**                      | If enabled, you can create new users through the SAML login. If disabled, then only existing Grafana users can log in with SAML.                                                                                                                              |
| **Auto login**                        | If enabled, Grafana will attempt to automatically log in with SAML skipping the login screen.                                                                                                                                                                 |
| **Single logout**                     | The SAML single logout feature enables users to log out from all applications associated with the current IdP session established using SAML SSO. For more information, refer to [SAML single logout documentation]]({{< relref "../saml#single-logout" >}}). |
| **Identity provider initiated login** | Enables users to log in to Grafana directly from the SAML IdP. For more information, refer to [IdP initiated login documentation]({{< relref "../saml#idp-initiated-single-sign-on-sso" >}}).                                                                 |

3. Click **Next: Key and certificate**.
1. Provide a certificate and a private key that will be used by the service provider (Grafana) and the SAML IdP.

   Use the [PKCS #8](https://en.wikipedia.org/wiki/PKCS_8) format to issue the private key.

   For more information, refer to an [example on how to generate SAML credentials]({{< relref "../saml#example-of-how-to-generate-saml-credentials" >}}).

1. In the **Sign requests** field, specify whether you want the outgoing requests to be signed, and, if so, which signature algorithm should be used.

   The SAML standard recommends using a digital signature for some types of messages, like authentication or logout requests to avoid [man-in-the-middle attacks](https://en.wikipedia.org/wiki/Man-in-the-middle_attack).

1. Click **Next: Connect Grafana with Identity Provider** and complete the section.
1. Click **Next: User mapping**.
1. If you wish to [map user information from SAML assertions]({{< relref "../saml#assertion-mapping" >}}), complete the **Assertion attributes mappings** section.

   You also need to configure the **Groups attribute** field if you want to use team sync. Team sync automatically maps users to Grafana teams based on their SAML group membership.
   Learn more about [team sync]({{< relref "../../configure-team-sync" >}}) and [configuring team sync for SAML]({{< relref "../saml#configure-team-sync" >}}).

1. If you want to automatically assign users' roles based on their SAML roles, complete the **Role mapping** section.

   First, you need to configure the **Role attribute** field to specify which SAML attribute should be used to retrieve SAML role information.
   Then enter the SAML roles that you want to map to Grafana roles in **Role mapping** section. If you want to map multiple SAML roles to a Grafana role, separate them by a comma and a space. For example, `Editor: editor, developer`.

   Role mapping will automatically update user's [basic role]({{< relref "../../../../administration/roles-and-permissions/access-control#basic-roles" >}}) based on their SAML roles every time the user logs in to Grafana.
   Learn more about [SAML role synchronization]({{< relref "../saml#configure-role-sync" >}}).

1. If you have multiple organizations and want to automatically add users to organizations, complete the **Org mapping section**.

   First, you need to configure the **Org attribute** field to specify which SAML attribute should be used to retrieve SAML organization information.
   Now fill in the **Org mapping** field with mappings from SAML organization to Grafana organization. For example, `Org mapping: Engineering:2, Sales:2` will map users who belong to `Engineering` or `Sales` organizations in SAML to Grafana organization with ID 2.
   If you want users to have different roles in different organizations, you can additionally specify a role. For example, `Org mapping: Engineering:2:Editor` will map users who belong to `Engineering` organizations in SAML to Grafana organization with ID 2 and assign them Editor role.

   Organization mapping will automatically update user's organization memberships (and roles, if they have been configured) based on their SAML organization every time the user logs in to Grafana.
   Learn more about [SAML organization mapping]({{< relref "../saml#configure-organization-mapping" >}}).

1. If you want to limit the access to Grafana based on user's SAML organization membership, fill in the **Allowed organizations** field.
1. Click **Next: Test and enable** and then click **Save and enable**.
   1. If there are issues with your configuration, an error message will appear. Refer back to the previous steps to correct the issues and click on `Save and apply` on the top right corner once you are done.
1. If there are no configuration issues, SAML integration status will change to `Enabled`.
   Your SAML configuration is now enabled.
1. To disable SAML integration, click `Disable` in the top right corner.
