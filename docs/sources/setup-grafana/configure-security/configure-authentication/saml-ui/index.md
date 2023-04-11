---
description: Learn how to configure SAML authentication in Grafana's UI.
menuTitle: Configure SAML using the UI
title: Configure SAML authentication using the Grafana user interface
weight: 1150
---

# Configure SAML authentication using the Grafana user interface

> **Note:** Available in [Grafana Enterprise]({{< relref "../../../introduction/grafana-enterprise/" >}}) version 10.0 and later, and [Grafana Cloud Pro and Advanced](/docs/grafana-cloud/).

You can configure SAML authentication in Grafana through the user interface (UI) or the Grafana configuration file. For instructions on how to set up SAML using the Grafana configuration file, refer to [Configure SAML authentication in Grafana]({{< relref "../saml/" >}}).

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

## Steps

You can save your SAML configuration, see SAML integration status and enable or disable SAML authentication on the top right-hand side.
If your SAML configuration is not valid or is incomplete, you will be notified about it when saving the configuration.

1. Sign in to Grafana and navigate to **Administration > Authentication > SAML**.
1. Click **General settings** and complete the section. Consult the following table for additional guidance about certain fields:

| Field               | Description                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| signup              | Determines whether to allow new Grafana user creation through SAML login. If disabled, then only existing Grafana users can log in with SAML.                                                                                                           |
| single logout       | SAML's single logout feature allows users to log out from all applications associated with the current IdP session established via SAML SSO. Consult [SAML single logout documentation]]({{< relref "../saml/#single-logout" >}}) for more information. |
| IdP initiated login | Allows users to log into Grafana directly from the SAML identity provider (IdP). Consult [IdP initiated login documentation]({{< relref "../saml/#idp-initiated-single-sign-on-sso" >}}) for more information.                                          |
