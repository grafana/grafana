+++
title = "Team sync"
description = "Grafana Team Sync"
keywords = ["grafana", "auth", "documentation"]
aliases = ["/docs/grafana/latest/auth/saml/"]
type = "docs"
[menu.docs]
name = "Team sync"
parent = "enterprise"
weight = 5
+++

# Team sync

> Only available in Grafana Enterprise.

{{< docs-imagebox img="/img/docs/enterprise/team_members_ldap.png" class="docs-image--no-shadow docs-image--right" max-width= "600px" >}}

With the Team Sync it's possible to setup synchronization between your auth providers teams and teams in Grafana. This enables LDAP or GitHub OAuth users which are members
of certain teams/groups to automatically be added/removed as members to certain teams in Grafana. Currently the synchronization will only happen every
time a user logs in, unless LDAP is used together with active background synchronization that was added in Grafana 6.3.

Grafana keeps track of all synchronized users in teams and you can see which users have been synchronized in the team members list, see `LDAP` label in screenshot.
This mechanism allows Grafana to remove an existing synchronized user from a team when its LDAP group membership (for example) changes. This mechanism also enables you to manually add a user as member of a team and it will not be removed when the user signs in. This gives you flexibility to combine LDAP group memberships and Grafana team memberships.

<div class="clearfix"></div>

### Enable synchronization for a team

{{< docs-imagebox img="/img/docs/enterprise/team_add_external_group.png" class="docs-image--no-shadow docs-image--right" max-width= "600px" >}}

1. Navigate to Configuration / Teams.
2. Select a team.
3. Select the External group sync tab and click on the `Add group` button.
4. Insert the value of the group you want to sync with. This becomes what Grafana denominates as a `GroupID`.

    - Using LDAP as an example, this is the LDAP distinguished name (DN) of LDAP group you want to synchronize with the team.
    - Using Auth Proxy as an example, this is the value we receive as part of the custom `Groups` header.

5. Click on `Add group` button to save.

### Supported Providers

* [LDAP]({{< relref "enhanced_ldap.md#ldap-group-synchronization-for-teams" >}})
* [GitHub OAuth]({{< relref "../auth/github.md#team-sync-enterprise-only" >}})
* [GitLab OAuth]({{< relref "../auth/gitlab.md#team-sync-enterprise-only" >}})
* [Auth Proxy]({{< relref "../auth/auth-proxy.md#team-sync-enterprise-only">}})
