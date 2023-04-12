---
description: Learn how to configure SAML authentication in Grafana's UI.
menuTitle: Configure SAML using the UI
title: Configure SAML authentication using the Grafana user interface
weight: 1150
---

# Configure SAML authentication using the Grafana user interface

> **Note:** Available in [Grafana Enterprise]({{< relref "../../../introduction/grafana-enterprise/" >}}) version 10.0 and later, and [Grafana Cloud Pro and Advanced](/docs/grafana-cloud/).

You can configure SAML authentication in Grafana through the user interface (UI) or the Grafana configuration file. For instructions on how to set up SAML using the Grafana configuration file, refer to [Configure SAML authentication using the configuration file]({{< relref "../saml/" >}}).

The Grafana SAML UI provides the following advantages over configuring SAML in the Grafana configuration file:

- It is accessible by hosted Grafana users
- It doesn't require Grafana to be restarted after a configuration update
- Access to the SAML UI only requires access to authentication settings, so it can be used by users with limited access to Grafana's configuration

> **Note:** Configuration in the UI takes precedence over the configuration in the Grafana configuration file. SAML settings from the UI will override any SAML configuration set in the Grafana configuration file.

## Before you begin

To follow this guide, you need:

- Knowledge of SAML authentication. Refer to [SAML authentication in Grafana]({{< relref "../saml/" >}}) for an overview of Grafana's SAML integration.
- Permissions that allow you to read and update authentication settings. These permissions are granted by `fixed:authentication.config:writer` role.
  By default, this role is granted to Grafana server administrator in self-hosted instances and to Organization admins in hosted Grafana instances.
- Grafana instance running Grafana version 10.0 or later with [Grafana Enterprise]({{< relref "../../../introduction/grafana-enterprise/" >}}) or [Grafana Cloud Pro or Advanced](/docs/grafana-cloud/) license.

## Steps

Follow these steps to configure and enable SAML integration:

1. Sign in to Grafana and navigate to **Administration > Authentication > Configure SAML**.
1. Complete the **General settings** fields.

   For assistance, consult the following table for additional guidance about certain fields:

| Field                                 | Description                                                                                                                                                                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Allow signup**                      | If enabled, you can create new users through the SAML login. If disabled, then only existing Grafana users can log in with SAML.                                                                                                                               |
| **Single logout**                     | The SAML single logout feature enables users to log out from all applications associated with the current IdP session established using SAML SSO. For more information, refer to [SAML single logout documentation]]({{< relref "../saml/#single-logout" >}}). |
| **Identity provider initiated login** | Enables users to log in to Grafana directly from the SAML IdP. For more information, refer to [IdP initiated login documentation]({{< relref "../saml/#idp-initiated-single-sign-on-sso" >}}).                                                                 |

1. Click **Next: Key and certificate**.
1. Provide a certificate and a private key that will be used by the service provider (Grafana) and the SAML IdP.

   Use the [PKCS #8](https://en.wikipedia.org/wiki/PKCS_8) format to issue the private key.

   For more information, refer to an [example on how to generate SAML credentials]({{< relref "../saml/#example-of-how-to-generate-saml-credentials" >}}).

1. In the **Sign requests** field, specify whether you want the outgoing requests to be signed, and, if so, which signature algorithm should be used.
1. Click **Next: Connect Grafana with Identity Provider** and complete the section.
1. Click **Next: User mapping**. If you wish to [map user information from SAML assertions]({{< relref "../saml/#assertion-mapping" >}}), complete this section. This section also allows you to set up SAML [team synchronization]({{< relref "../saml/#configure-team-sync" >}}), [role synchronization]({{< relref "../saml/#configure-role-sync" >}}) and [organization mapping]({{< relref "../saml/#configure-organization-mapping" >}}).
1. Click **Next: Test and enable** and then click **Save and enable**.
   1. If there are issues with your configuration, an error message will appear. Refer back to the previous steps to correct the issues and click on `Save and apply` on the top right corner once you are done.
1. If there are no configuration issues, SAML integration status will change to `Enabled`.
   Your SAML configuration is now enabled.
1. To disable SAML integration, click `Disable` in the top right corner.
