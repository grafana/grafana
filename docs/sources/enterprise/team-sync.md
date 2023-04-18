---
title: 'Team sync'
description: 'Grafana Team Sync'
keywords: ['grafana', 'auth', 'documentation']
weight: 1000
---

# Team sync

{{< figure src="/static/img/docs/enterprise/team_members_ldap.png" class="docs-image--no-shadow docs-image--right" max-width= "600px" >}}

Team sync lets you set up synchronization between your auth providers teams and teams in Grafana. This enables LDAP, OAuth, or SAML users who are members of certain teams or groups to automatically be added or removed as members of certain teams in Grafana.

> Available in Grafana Cloud Pro and Advanced and in Grafana Enterprise.

Grafana keeps track of all synchronized users in teams, and you can see which users have been synchronized in the team members list, see `LDAP` label in screenshot.
This mechanism allows Grafana to remove an existing synchronized user from a team when its group membership changes. This mechanism also enables you to manually add a user as member of a team, and it will not be removed when the user signs in. This gives you flexibility to combine LDAP group memberships and Grafana team memberships.

> Currently the synchronization only happens when a user logs in, unless LDAP is used with the active background synchronization that was added in Grafana 6.3.

<div class="clearfix"></div>

## Supported providers

- [Auth Proxy]({{< relref "../auth/auth-proxy.md#team-sync-enterprise-only">}})
- [Azure AD]({{< relref "../auth/azuread.md#team-sync-enterprise-only" >}})
- [GitHub OAuth]({{< relref "../auth/github.md#team-sync-enterprise-only" >}})
- [GitLab OAuth]({{< relref "../auth/gitlab.md#team-sync-enterprise-only" >}})
- [LDAP]({{< relref "enhanced_ldap.md#ldap-group-synchronization-for-teams" >}})
- [Okta]({{< relref "../auth/okta.md#team-sync-enterprise-only" >}})
- [SAML]({{< relref "saml.md#configure-team-sync" >}})

## Synchronize a Grafana team with an external group

If you have already grouped some users into a team, then you can synchronize that team with an external group.

{{< figure src="/static/img/docs/enterprise/team_add_external_group.png" class="docs-image--no-shadow docs-image--right" max-width= "600px" >}}

1. In Grafana, navigate to **Configuration > Teams**.
1. Select a team.
1. On the External group sync tab, and click **Add group**.
1. Insert the value of the group you want to sync with. This becomes the Grafana `GroupID`.
   Examples:

   - For LDAP, this is the LDAP distinguished name (DN) of LDAP group you want to synchronize with the team.
   - For Auth Proxy, this is the value we receive as part of the custom `Groups` header.

1. Click `Add group` to save.
