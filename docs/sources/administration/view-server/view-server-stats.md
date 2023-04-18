---
aliases:
  - ../../admin/view-server-stats/
keywords:
  - grafana
  - server
  - statistics
title: View server stats
weight: 400
---

# View Grafana server stats

> Refer to [Fine-grained access control]({{< relref "../../enterprise/access-control/_index.md" >}}) in Grafana Enterprise to understand how you can control access with fine-grained permissions.

If you are a Grafana server admin, then you can view useful statistics about your Grafana server in the Stats & Licensing tab.

> **Note:** Only Grafana server administrators can access the **Server Admin** menu. For more information about about administrative permissions, refer to [Grafana server admin]({{< relref "../../permissions/_index.md" >}}).

## View server stats

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Hover your cursor over the **Server Admin** (shield) icon in the side menu and then click the **Stats & Licensing** tab.

## Available stats

The following statistics are displayed in the Stats tab:

- Total users
  **Note:** Total users = Total admins + Total editors + Total viewers
- Total admins
- Total editors
- Total viewers
- Active users (seen last 30 days)
  **Note:** Active users = Active admins + Active editors + Active viewers
- Active admins (seen last 30 days)
- Active editors (seen last 30 days)
- Active viewers (seen last 30 days)
- Active sessions
- Total dashboards
- Total orgs
- Total playlists
- Total snapshots
- Total dashboard tags
- Total starred dashboards
- Total alerts

## Counting users

If a user belongs to several organizations, then that user is counted once as a user in the highest organization role they are assigned, regardless of how many organizations the user belongs to.

For example, if Sofia is a Viewer in two organizations, an Editor in two organizations, and Admin in three organizations, then she would be reflected in the stats as:

- Total users 1
- Total admins 1
