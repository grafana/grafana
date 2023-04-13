---
description: Guide for upgrading to Grafana v10.0
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
title: Upgrade to Grafana v10.0
menutitle: Upgrade to v10.0
weight: 1700
---

# Upgrade to Grafana v10.0

{{< docs/shared "upgrade/upgrade-common-tasks.md" >}}

## Technical notes

### Role-based access control changes

Role-based access control (RBAC) is now always enabled in Grafana 10 and we've removed the option to disable it, no action needs to be taken.

However, if you decide to **downgrade** for any reason and **disable RBAC**, you will need to run through the following guide before upgrading again.

The aforementioned sequence of actions (upgrade, downgrade, disable RBAC, upgrade again) causes legacy access control and role-based access control systems to be out of sync.
As a side effect, permissions for some Grafana resources, like dashboards, might be lost.
To prevent that from happening, before you upgrading Grafana back again, please follow the following steps:

1. Stop Grafana
2. In your database, run the following SQL queries:

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

3. Start Grafana again.

### Case-insensitive usernames and email addresses

Usernames and email addresses are now treated as case-insensitive in Grafana. If you are not using MySQL as a database, potential user identity conflicts may arise when users try to log in.
It is recommended to resolve any potential conflicts in advance by using the [Grafana CLI tool for managing user conflicts](https://grafana.com/blog/2022/12/12/guide-to-using-the-new-grafana-cli-user-identity-conflict-tool-in-grafana-9.3/).
