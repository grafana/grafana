+++
title = "SAML Authentication"
description = "Grafana SAML Authentication"
keywords = ["grafana", "saml", "documentation", "saml-auth"]
aliases = ["/docs/grafana/latest/auth/saml/"]
type = "docs"
[menu.docs]
name = "SAML"
parent = "authentication"
weight = 5
+++

# SAML authentication

The SAML authentication integration allows your Grafana users to log in by using an external SAML Identity Provider (IdP). To enable this, Grafana becomes a Service Provider (SP) in the authentication flow, interacting with the IdP to exchange user information.

> SAML authentication integration is only available in Grafana Enterprise v6.3 or later. For more information, refer to [SAML authentication]({{< relref "../enterprise/saml.md" >}}) in [Grafana Enterprise]({{< relref "../enterprise" >}}).
