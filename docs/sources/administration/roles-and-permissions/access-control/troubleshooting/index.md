---
aliases:
  - ../../../enterprise/access-control/troubleshooting/
labels:
  products:
    - cloud
    - enterprise
    - oss
description: RBAC troubleshooting guide.
menuTitle: Troubleshooting RBAC
title: Troubleshooting RBAC
weight: 80
---

# Troubleshooting RBAC

In this section, you’ll learn about logs that are available for RBAC and you’ll find the most common RBAC issues.

## Enable debug logging

You can enable debug log messages for RBAC in the Grafana configuration file. Debug logs are added to the Grafana server logs.

```bash
[log]
filters = accesscontrol:debug accesscontrol.evaluator:debug dashboard.permissions:debug
```

## Enable audit logging

{{% admonition type="note" %}}
Available in [Grafana Enterprise]({{< relref "../../introduction/grafana-enterprise/" >}}) version 7.3 and later, and [Grafana Cloud](/docs/grafana-cloud).
{{% /admonition %}}

You can enable auditing in the Grafana configuration file.

```bash
[auditing]
enabled = true
```

All permission and role updates, and role assignments are added to audit logs.
Learn more about [access control audit logs]({{< relref "../../../../setup-grafana/configure-security/audit-grafana/#access-control" >}}).

## Missing dashboard, folder or data source permissions

[Dashboard and folder permissions]({{< relref "../../#dashboard-permissions" >}}) and [data source permissions]({{< relref "../../#data-source-permissions" >}}) can go out of sync if a Grafana instance version is upgraded, downgraded and then upgraded again.
This happens when an instance is downgraded from a version that uses RBAC to a version that uses the legacy access control, and dashboard, folder or data source permissions are updated.
These permission updates will not be applied to RBAC, so permissions will be out of sync when the instance is next upgraded to a version with RBAC.

{{% admonition type="note" %}}
the steps provided below will set all dashboard, folder and data source permissions to what they are set to with the legacy access control.
If you have made dashboard, folder or data source permission updates with RBAC enabled, these updates will be wiped.
{{% /admonition %}}

To resynchronize the permissions:

1. make a backup of your database
1. run the following SQL queries
   ```sql
   DELETE
   FROM builtin_role
   where role_id IN (SELECT id
                     FROM role
                     WHERE name LIKE 'managed:%');
   DELETE
   FROM team_role
   where role_id IN (SELECT id
                     FROM role
                     WHERE name LIKE 'managed:%');
   DELETE
   FROM user_role
   where role_id IN (SELECT id
                     FROM role
                     WHERE name LIKE 'managed:%');
   DELETE
   FROM permission
   where role_id IN (SELECT id
                     FROM role
                     WHERE name LIKE 'managed:%');
   DELETE
   FROM role
   WHERE name LIKE 'managed:%';
   DELETE
   FROM migration_log
   WHERE migration_id IN ('teams permissions migration',
                          'dashboard permissions',
                          'dashboard permissions uid scopes',
                          'data source permissions',
                          'data source uid permissions',
                          'managed permissions migration',
                          'managed folder permissions alert actions repeated migration',
                          'managed permissions migration enterprise');
   ```
1. restart your Grafana instance
