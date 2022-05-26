---
description: How to change your Grafana timezone
keywords:
  - grafana
  - configuration
  - documentation
  - home
title: Change default timezone
weight: 400
---

# Change the Grafana default timezone

By default, Grafana uses the timezone in your web browser. However, you can override this setting at the server, organization, team, or individual user level. This topic provides instructions for each task.

{{< docs/shared "preferences/some-tasks-require-permissions.md" >}}

## Set server timezone

Grafana server administrators can choose a default timezone for all users on the server by setting the [default_timezone]({{< relref "../configuration.md#default-timezone" >}}) option in the Grafana configuration file.

## Set organization timezone

Organization administrators can choose a default timezone for their organization.

{{< docs/list >}}
{{< docs/shared "preferences/org-preferences-list.md" >}}
{{< docs/shared "preferences/select-timezone-list.md" >}}
{{< /docs/list >}}

## Set team timezone

Organization administrators and team administrators can choose a default timezone for all users in a team.

{{< docs/list >}}
{{< docs/shared "manage-users/view-team-list.md" >}}

1. Click on the team you that you want to change the timezone for and then navigate to the **Settings** tab.
   {{< docs/shared "preferences/select-timezone-list.md" >}}
   {{< /docs/list >}}

## Set your personal timezone

You can change the timezone for your user account. This setting overrides timezone settings at higher levels.

{{< docs/list >}}
{{< docs/shared "preferences/navigate-user-preferences-list.md" >}}
{{< docs/shared "preferences/select-timezone-list.md" >}}
{{< /docs/list >}}
