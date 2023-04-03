---
description: Learn how to configure SAML authentication in Grafana's UI.
menuTitle: Configure SAML authentication in UI
title: Configure SAML authentication in Grafana's UI
weight: 1150
---

# Configure SAML authentication in Grafana

> **Note:** Available in [Grafana Enterprise]({{< relref "../../../introduction/grafana-enterprise/" >}}) version 10.0 and later, and [Grafana Cloud Pro and Advanced](/docs/grafana-cloud/).

You can configure SAML authentication in Grafana either through the UI or the Grafana config file.

Grafana SAML UI has the following advantages over configuring SAML in the Grafana config file:

- It is accessible by hosted Grafana users;
- It doesn't require Grafana to be restarted after a configuration update;
- Access to SAML UI only requires access to SAML settings, so it can be used by users with limited access to Grafana's configuration.

Configuration in the UI takes precedence over configuration in the Grafana config file.

Learn more about [SAML authentication in Grafana and how to set it up through the Grafana config file]({{< relref "../saml/" >}}).

# SAML UI

SAML UI is located under **Authentication > Authentication > SAML**.

You can save your SAML configuration, see SAML integration status and enable or disable SAML authentication on the top right-hand side.
If your SAML configuration is not valid or is incomplete, you will be notified about it when saving the configuration.

SAML configuration is split across several pages. You can navigate between them by clicking on page titles on top of the screen or arrows on the bottom of the screen.

## Access requirements

To access SAML UI, user needs `fixed:authentication.config:writer` role.
By default, this role is granted to Grafana server administrator in self-hosted instances and to Organization admins in hosted Grafana instances.

## Updating the general settings

Under `General settings` page you can update the following settings:

- name for this configuration
- [signup]({{< relref "../saml/#allow-new-user-signups" >}})
- [single logout]]({{< relref "../saml/#single-logout" >}})
- [IdP initiated login]({{< relref "../saml/#configure-automatic-login" >}})
- [maximum issue delay]({{< relref "../saml/#maximum-issue-delay" >}})
- [duration for how long Grafana's metadata is valid]({{< relref "../saml/#metadata-valid-duration" >}})
