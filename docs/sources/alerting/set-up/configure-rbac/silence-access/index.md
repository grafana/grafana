---
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/configure-rbac/silence-access/
description: Learn how Grafana Alerting controls access to silences using role-based access control. Understand general and rule-specific silence types, configure folder-scoped permissions, and set up access for restricted teams or on-call engineers.
keywords:
  - grafana
  - alerting
  - set up
  - configure
  - RBAC
  - silences
  - permissions
labels:
  products:
    - enterprise
    - cloud
title: Configure silence access
weight: 300
refs:
  configure-rbac:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-rbac/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-rbac/
  access-roles:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-rbac/access-roles/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-rbac/access-roles/
  access-folders:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-rbac/access-folders/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-rbac/access-folders/
  configure-silences:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-silence/
---

# Configure silence access

This article describes how Grafana Alerting controls access to silences and how to configure it for your teams. Use this article when you need to give some users full silence management while limiting others to silencing only their own rules.

Before you begin, ensure you have:

- Admin access to the Grafana organization
- Familiarity with [Grafana RBAC](ref:configure-rbac) and [fixed roles](ref:access-roles)

## Silence types

Grafana Alerting has two types of silences:

- **General silences** — not attached to any specific alert rule. They can match alerts from any rule in the organization. Only users with org-scoped silence permissions can create them.
- **Rule-specific silences** — linked to a single alert rule via its UID. Access is controlled by the folder that contains the rule.

When you silence a firing alert directly from the alert list, Grafana creates a rule-specific silence automatically by adding the label matcher `__alert_rule_uid__=<rule UID>`. You can also create a rule-specific silence manually by including this matcher.

## Silence permissions

Grafana has two independent sets of permissions for silences. They serve different purposes and apply to different scopes.

### Org-scoped permissions

These permissions apply across the whole organization and cover both silence types.

| Action                   | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `alert.instances:read`   | Read all silences — general and rule-specific  |
| `alert.instances:create` | Create any silence, including general silences |
| `alert.instances:write`  | Update or expire any silence                   |

The built-in `Editor` role includes all three via the `fixed:alerting.instances:writer` fixed role.

### Folder-scoped permissions

These permissions are scoped to a specific folder. Users with only these permissions can manage rule-specific silences for rules in the granted folder, but can't create general silences.

| Action                  | Description                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `alert.silences:read`   | Read rule-specific silences for rules in the folder, plus all general silences org-wide |
| `alert.silences:create` | Create rule-specific silences for rules in the folder                                   |
| `alert.silences:write`  | Update or expire rule-specific silences for rules in the folder                         |

{{< admonition type="note" >}}
`alert.silences:read` always includes all general silences, regardless of the folder scope. General silences can suppress notifications for any rule, so users managing rules in a folder need to see silences that may affect their alerts.
{{< /admonition >}}

## Fixed roles

The following fixed roles are relevant to silence management.

| Fixed role                                                        | Permissions                                                     | What it allows                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| `fixed:alerting.instances:writer` (Silences Writer)               | `alert.instances:create`, `alert.instances:write` (org scope)   | Create and manage general and rule-specific silences org-wide |
| `fixed:alerting.instances:reader` (Instances and Silences Reader) | `alert.instances:read` (org scope)                              | Read all silences                                             |
| `fixed:alerting.rules:writer` (Rules Writer)                      | `alert.silences:create`, `alert.silences:write` for `folders:*` | Create and manage rule-specific silences                      |
| `fixed:alerting.rules:reader` (Rules Reader)                      | `alert.silences:read` for `folders:*`                           | Read rule-specific silences and all general silences          |

## Folder permission mapping in Grafana OSS

In Grafana OSS, custom RBAC isn't available. Instead, folder permissions automatically grant the corresponding silence access.

| Folder permission | Silence access                                                                     |
| ----------------- | ---------------------------------------------------------------------------------- |
| View              | Read all general silences; read rule-specific silences for rules in the folder     |
| Edit              | View access, plus create and update rule-specific silences for rules in the folder |
| Admin             | Same as Edit                                                                       |

In Grafana Enterprise and Grafana Cloud, folder permissions grant the same silence access as in OSS, but you can go further by assigning folder-scoped RBAC permissions independently of rule access — for example, granting silence write access without granting rule write access.

## Scenario: restrict users to rule-specific silences only

Use this setup when a team should be able to silence their own rules but must not create general silences that affect the whole organization.

Grant the following folder-scoped permissions for the team's folder:

| Permission              | Scope                  |
| ----------------------- | ---------------------- |
| `alert.silences:read`   | `folders:<FOLDER_UID>` |
| `alert.silences:create` | `folders:<FOLDER_UID>` |
| `alert.silences:write`  | `folders:<FOLDER_UID>` |

These permissions are included in `fixed:alerting.rules:writer` and are also granted automatically by the folder **Edit** permission.

**Do not** grant `alert.instances:create` or `alert.instances:write` at org scope — these allow creating general silences. They're bundled into `fixed:alerting.instances:writer` and the built-in `Editor` role, so avoid assigning either to users who should be folder-restricted.

With this configuration:

- Users can create silences only for rules in their folder.
- Users can read all general silences.
- Any attempt to create a general silence is rejected.

## Scenario: grant full silence access

Use this setup for on-call engineers or administrators who need full control over all silences.

Assign the following fixed roles:

| Fixed role                        | Grants                                                        |
| --------------------------------- | ------------------------------------------------------------- |
| `fixed:alerting.instances:writer` | Create and manage general and rule-specific silences org-wide |
| `fixed:alerting.rules:writer`     | Create and manage rule-specific silences across all folders   |

Alternatively, assign the built-in `Editor` role, which includes both.

With this configuration:

- Users can create general silences for org-wide maintenance windows.
- Users can create and expire rule-specific silences for any rule.
- Users see all silences across the organization.

## Security considerations

Keep the following in mind when configuring silence access.

- **Org-scoped write actions are powerful.** Granting `alert.instances:create` or `alert.instances:write` at org scope — even to a user who otherwise has only folder-level access — allows them to create or modify silences that affect the entire organization. Review all custom and inherited roles that include these actions.
- **General silences are always visible to folder users.** You can't hide general silences from users who have any folder-scoped `alert.silences:read` permission. If general silences carry sensitive context (such as the name of an active incident), use clear, consistent naming conventions.
- **Use rule-specific silences for team isolation.** In multi-team or multi-tenant deployments, rule-specific silences are the recommended pattern. They respect folder boundaries, which general silences don't.

## Next steps

- [Configure silences](ref:configure-silences) — create, edit, and expire silences
- [Manage access using roles](ref:access-roles) — full reference for fixed and custom roles
- [Manage access using folders](ref:access-folders) — folder-based access for alert rules and silences
