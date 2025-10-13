---
description: Upgrade to Grafana v10.0
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
labels:
  products:
    - enterprise
    - oss
menutitle: Upgrade to v10.0
title: Upgrade to Grafana v10.0
weight: 1700
---

# Upgrade to Grafana v10.0

{{< docs/shared lookup="upgrade/intro.md" source="grafana" version="<GRAFANA VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA VERSION>" >}}

## Technical notes

### Role-based access control changes

<!-- Vardan Torosyan -->

Role-based access control (RBAC) is now always enabled and we've removed the option to disable it.

No action is required.

However, if you decide to **downgrade** for any reason and **disable RBAC**, you'll need to run through the following guide before upgrading again.

The aforementioned sequence of actions (upgrade, downgrade, disable RBAC, upgrade again) causes legacy access control and role-based access control systems to be out of sync.
As a side effect, permissions for some Grafana resources, like dashboards, might be lost.
To prevent that from happening, before you upgrade Grafana back again, please take the following steps:

1. Stop Grafana.
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

<!-- Vardan Torosyan -->

Usernames and email addresses are now treated as case-insensitive in Grafana. If you're not using MySQL as a database, potential user identity conflicts may arise when users try to log in.
We recommend you resolve any potential conflicts in advance by using the [Grafana CLI tool for managing user conflicts](/blog/2022/12/12/guide-to-using-the-new-grafana-cli-user-identity-conflict-tool-in-grafana-9.3/).

### Dashboard previews removal

<!-- Artur Wierzbicki -->

We've removed the Dashboard previews feature introduced behind a feature flag in Grafana version 9.0.

No action is required.

The `dashboardPreviews` feature flag is no longer available and can be safely removed from the Grafana server configuration.
