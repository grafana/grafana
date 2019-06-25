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

> Enhanced LDAP Integration is only available in Grafana Enterprise. Read more about [Grafana Enterprise]({{< relref "enterprise" >}}).

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

## Active LDAP Synchronization

In the open source version of Grafana, user data from LDAP will be synchronized only during the login process when authenticating using LDAP.

With this feature you can configure Grafana to actively sync users with LDAP server(s) in the background. Role and team membership will be updated, removed users will be disabled and logged out. Only users that have logged into Grafana at least once will be synchronized.```

```bash
[auth.ldap]
...

# You can use the Cron syntax or several predefined schedulers - 
# @yearly (or @annually) | Run once a year, midnight, Jan. 1st        | 0 0 0 1 1 *
# @monthly               | Run once a month, midnight, first of month | 0 0 0 1 * *
# @weekly                | Run once a week, midnight between Sat/Sun  | 0 0 0 * * 0
# @daily (or @midnight)  | Run once a day, midnight                   | 0 0 0 * * *
# @hourly                | Run once an hour, beginning of hour        | 0 0 * * * * 
sync_cron = "@hourly"
# This cron expression format uses 6 space-separated fields (including seconds), for example
# sync_cron = "* */10 * * * *" 
# This will run the LDAP Synchronization every 10th minute, which is also the minimal interval between the grafana sync times i.e. you cannot set it for every 9th minute
```
