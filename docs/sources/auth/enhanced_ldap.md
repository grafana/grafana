+++
title = "Enhanced LDAP Integration"
description = "Grafana Enhanced LDAP Integration Guide "
keywords = ["grafana", "configuration", "documentation", "ldap", "active directory", "enterprise"]
type = "docs"
[menu.docs]
name = "Enhanced LDAP"
identifier = "enhanced-ldap"
parent = "authentication"
weight = 3
+++

# Enhanced LDAP Integration

> Enhanced LDAP Integration is only available in Grafana Enterprise. Read more about [Grafana Enterprise]({{< relref "enterprise/index.md" >}}).

The enhanced LDAP integration adds additional functionality on top of the [existing LDAP integration]({{< relref "auth/ldap.md" >}}).

## LDAP Group Synchronization for Teams

{{< docs-imagebox img="/img/docs/enterprise/team_members_ldap.png" class="docs-image--no-shadow docs-image--right" max-width= "600px" >}}

With the enhanced LDAP integration it's possible to setup synchronization between LDAP groups and teams. This enables LDAP users which are members
of certain LDAP groups to automatically be added/removed as members to certain teams in Grafana. Currently the synchronization will only happen every
time a user logs in, but an active background synchronization is currently being developed.

Grafana keeps track of all synchronized users in teams and you can see which users have been synchronized from LDAP in the team members list, see `LDAP` label in screenshot.
This mechanism allows Grafana to remove an existing synchronized user from a team when its LDAP group membership changes. This mechanism also enables you to manually add
a user as member of a team and it will not be removed when the user signs in. This gives you flexibility to combine LDAP group memberships and Grafana team memberships.

<div class="clearfix"></div>

### Enable LDAP group synchronization for a team

{{< docs-imagebox img="/img/docs/enterprise/team_add_external_group.png" class="docs-image--no-shadow docs-image--right" max-width= "600px" >}}

1. Navigate to Configuration / Teams.
2. Select a team.
3. Select the External group sync tab and click on the `Add group` button.
4. Insert LDAP distinguished name (DN) of LDAP group you want to synchronize with the team.
5. Click on `Add group` button to save.

<div class="clearfix"></div>
