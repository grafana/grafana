+++
title = "Authentication"
description = "Authentication"
type = "docs"
[menu.docs]
name = "Authentication"
identifier = "authentication"
parent = "admin"
weight = 30
+++

# User Authentication Overview

Grafana provides many ways to authenticate users. Some authentication integrations also enable syncing user permissions and org memberships.

Here is a table showing all supported authentication providers and the features available for them. [Team sync]({{< relref "../enterprise/team-sync.md" >}}) and [active sync]({{< relref "../enterprise/enhanced_ldap.md#active-ldap-synchronization" >}}) are only available in Grafana Enterprise.

See also, [Grafana Authentication]({{< relref "grafana.md" >}}).

Provider | Support | Role mapping | Team sync<br> *(Enterprise only)* | Active sync<br> *(Enterprise only)*
-------- | :-----: | :----------: | :-------: | :---------: 
[Auth Proxy]({{< relref "auth-proxy.md" >}})       | v2.1+ | - | v6.3+ | - 
[Azure AD OAuth]({{< relref "azuread.md" >}})      | v6.7+ | v6.7+ | v6.7+ | - 
[Generic OAuth]({{< relref "generic-oauth.md" >}}) | v4.0+ | v6.5+ | - | - 
[GitHub OAuth]({{< relref "github.md" >}})         | v2.0+ | - | v6.3+ | -
[GitLab OAuth]({{< relref "gitlab.md" >}})         | v5.3+ | - | v6.4+ | -
[Google OAuth]({{< relref "google.md" >}})         | v2.0+ | - | - | - 
[LDAP]({{< relref "ldap.md" >}})                   | v2.1+ | v2.1+ | v5.3+ | v6.3+
[Okta OAuth]({{< relref "okta.md" >}})             | v7.0+ | v7.0+ | v7.0+ | - 
[SAML]({{< relref "../enterprise/saml.md" >}}) (Enterprise only)    | v6.3+ | v7.0+ | v7.0+ | - 
