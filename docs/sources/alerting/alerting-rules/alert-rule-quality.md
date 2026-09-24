---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/alert-rule-quality/
description: Configure an alert rule quality policy, review findings, and optionally enforce annotation and label requirements for Grafana-managed alert rules.
keywords:
  - alerting
  - annotations
  - enforcement
  - grafana
  - labels
  - quality
labels:
  products:
    - enterprise
    - cloud
title: Improve alert rule quality
weight: 600
draft: true
refs:
  configure-rbac:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-rbac/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-rbac/
  labels-and-annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/
  notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/
  terraform-provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/terraform-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/terraform-provisioning/
  http-api-provisioning:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/http-api-provisioning/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/provision-alerting-resources/http-api-provisioning/
---

<!--
Draft pending release confirmation. Target: Grafana Enterprise 13.3.x and Grafana Cloud.
Before publishing: confirm product naming, Grafana Cloud rollout, and the release stage.
Set labels.stage, remove draft: true, and link this page from Configure alert rules.
Keep feature-toggle and rollout procedures in the internal runbook.
-->

# Improve alert rule quality

Missing context can make alerts harder to act on.
A runbook URL helps you investigate an issue, and a team label helps you route your notifications.

With alert rule quality in Grafana, you can:

- Define which labels and annotations are required for Grafana-managed alert rules.
- Find rules with missing required labels or annotations and update them.
- Optionally enforce selected requirements on supported provisioning writes.

## Before you begin

Before you begin, check that you have the following permissions in your Grafana organization:

- **Rule access:** Have permission to view the Grafana-managed alert rules you want to assess.
- **Policy permissions:** To configure the policy, have the Admin role in your organization or a role with `alert.rules.quality:write` and `alert.rules:read`.
- **Rule updates:** To fix findings, have permission to update the affected rules.
  For provisioned rules, you also need access to their source configuration and permission to reapply it.

For more information about alerting permissions and folder access, refer to [Configure RBAC](ref:configure-rbac).

## Understand policy scope

A single quality policy applies to Grafana-managed alert rules across folders in your organization.
Data source-managed alert rules and recording rules are excluded.

The policy reports a finding when a required label or annotation is missing, empty, or contains only whitespace.
These checks validate presence, not content.
For example, requiring a runbook URL doesn't check whether the link works.

### Detection and enforcement

You choose a mode for each requirement:

| Mode        | Behavior                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| Detect-only | Missing values appear as findings but don't block rule creation or updates.                                |
| Enforced    | Missing values appear as findings and block rule creation or updates through supported provisioning paths. |

Both modes contribute to the quality score.
Enabling enforcement doesn't stop existing rules from evaluating or sending notifications.

### Supported enforcement paths

Enforcement applies to provisioned rules created or updated through Terraform, `kubectl`, or the Alerting provisioning HTTP API, with the following exceptions:

- Provisioning API requests that set the `X-Disable-Provenance` header, including Terraform `grafana_rule_group` resources with `disable_provenance = true`, aren't enforced.
- `kubectl` writes are enforced only when the manifest sets `grafana.app/managedBy` to `kubectl` or `terraform` together with a non-empty `grafana.app/managerId`, or sets `grafana.com/provenance` to `api`.

Writes from the Grafana rule editor aren't enforced, but the resulting rules can still have quality findings.
File provisioning is also excluded from enforcement.

If Grafana can't read the policy, it allows the write to proceed without enforcing quality requirements.

## Configure a quality policy

Start with detect-only requirements to identify missing information before enabling enforcement.
The following example requires a runbook URL and a `team` label.

To configure a quality policy, follow these steps:

1. Go to **Alerting** > **Settings** and select **Alert rule quality**.
1. Under **Required annotations**, turn on **Runbook URL**.

   You can also require **Summary** and **Description**.

1. Under **Required labels**, enter `team` in **Label keys** and select the matching option.

   You can select keys already used by your rules or add a new key.

1. Keep **Enforce** off for the requirements you add.

   New requirements start in detect-only mode.

1. Click **Save**.

   Grafana displays **Policy saved** to confirm the change.

The saved policy identifies rules with missing or empty `runbook_url` annotations or `team` labels.
Continue to [Review alert quality](#review-alert-quality) to inspect the findings.

A policy with no required annotations or labels checks nothing.

## Review alert quality

The **Alert quality** tab lists rules that don't meet your policy and shows an overall quality score.

To review the findings, follow these steps:

1. Go to **Alerting** > **Alert rules** and select **Alert quality**.
1. Review the **Alert quality score** and the number of rules that need attention.
1. Inspect the missing-field badges on each rule.

   Each badge names the missing field and its mode, for example **Runbook URL · Enforced** or **Runbook URL · Detect-only**.
   The list shows rules with the most missing fields first.

1. Use **Search** to narrow the list by rule name, folder, group, or label.

### Understand the score

The score represents the proportion of assessed rules that meet every configured requirement, on a scale of 0 to 10.
For example, if 8 of 10 rules meet the policy, the score is 8.0.
Grafana rounds the score to one decimal place.

Both detect-only and enforced requirements count toward the score.
The score measures compliance with your policy, not alert accuracy, severity, or noise.

Your permissions determine which rules you can view and assess.
Search filters change the findings list, not the score or the total rule count.
Grafana also displays 10.0 when there are no rules to assess, so check the rule count alongside the score.

If no requirements are configured, Grafana displays a message instead of a score.
With a configured policy and no findings, Grafana displays a score of 10.0 and a completion message.

### Filter the findings

Enter a rule name in **Search**, or use the following filters:

| Example               | Finds                                                    |
| --------------------- | -------------------------------------------------------- |
| `rule:cpu`            | Rules with names that contain `cpu`, regardless of case. |
| `namespace:Platform`  | Rules in the top-level folder `Platform`.                |
| `group:production`    | Rules in the evaluation group named `production`.        |
| `label:team=platform` | Rules with a `team` label set to `platform`.             |

Combine filters to narrow the results further.
Use quotes around values containing spaces, such as `namespace:"Platform alerts"`.
Label filters match labels already on the rule, not missing label requirements.
The `namespace` filter requires the full folder path, such as `namespace:Parent/Platform` for a nested folder, and is case-sensitive.

## Resolve quality findings

Add meaningful values for the missing fields in each rule.
For the example policy, set `runbook_url` to the rule's runbook URL and `team` to the owning team's name.

Changing label values can affect notification routing.
Choose values that match your team's [notification policies](ref:notification-policies).

### Update provisioned rules

For provisioned rules, make changes in the source configuration so they remain part of your provisioning workflow.

To resolve a finding on a provisioned rule, follow these steps:

1. Locate the rule in its source configuration, using the rule name, folder, and group shown in **Alert quality**.
1. Add values for the missing annotations and labels.
1. Reapply the configuration through your usual provisioning workflow.
1. Reload the **Alert quality** page and check the rule's findings.

A rule disappears from the findings list when it meets every configured requirement.
If other required fields are still missing, the rule remains in the list with those findings.

### Update rules in Grafana

For rules that you can edit in Grafana, use the **Edit** action on the quality page.

To resolve a finding in the rule editor, follow these steps:

1. Click **Edit** for the affected rule.
1. Fill in the missing annotations and labels in the rule editor.
1. Click **Save**.
1. Return to **Alert quality** and reload the page to check the findings.

## Optional: Enforce quality requirements

After reviewing and resolving findings, enable enforcement for the requirements you want to apply to supported provisioning writes.
You can enforce selected requirements while keeping others detect-only.

To enable enforcement, follow these steps:

1. Go to **Alerting** > **Settings** and select **Alert rule quality**.
1. Turn on **Enforce** beside each requirement you want to enforce.

   For example, enforce `team` while keeping **Runbook URL** detect-only.
   To enforce all currently configured requirements, turn on **Enforce all requirements** instead.

1. Click **Save**.

   Grafana displays **Policy saved** to confirm the change.

When only some requirements are enforced, the form displays **Some requirements enforced**.
New requirements still start detect-only, even if you previously enforced all requirements.
The **Enforce all requirements** control is unavailable when the policy has no requirements.

### Disable enforcement or remove a requirement

To return a requirement to detect-only, turn off its **Enforce** control (or **Enforce all requirements**, if every requirement is enforced) and click **Save**.
The requirement remains in the policy and continues to affect the quality score.

To stop checking a field altogether, remove its requirement instead: turn off its switch under **Required annotations**, or remove its key from **Label keys**. Then click **Save**.

## Troubleshoot quality findings and rejected writes

Use the following guidance when you can't access the feature, resolve a finding, or apply a rule change.

| Symptom                                                     | Action                                                                                                                                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alert quality** or **Alert rule quality** isn't visible.  | Ask your stack administrator to check your [permissions](#before-you-begin) and the feature's availability in your stack.                                                                 |
| A rule has no **Edit** action.                              | If it has a **Provisioned** badge, update its source configuration. Otherwise, check your permission to update rules in that folder.                                                      |
| Grafana reports that no quality policy is configured.       | Add at least one requirement in **Alert rule quality** and click **Save**. An empty policy doesn't assess any fields.                                                                     |
| No findings match your search, but the score is below 10.0. | Clear **Search** to view all findings. Search filters don't change the score.                                                                                                             |
| A finding remains after enforcement is disabled.            | Detect-only requirements still produce findings. Fill in the missing value or remove the requirement from the policy.                                                                     |
| A provisioning write is rejected by the quality policy.     | Use the rule and field details in the error to update the source configuration, then reapply it.                                                                                          |
| A write succeeds despite a quality finding.                 | Check that the requirement is enforced and the policy is saved. Confirm that the write uses a [supported enforcement path](#supported-enforcement-paths) and isn't one of its exceptions. |

## Next steps

Use these guides to improve rule context, manage rules as code, and configure access:

- **Rule context:** [Labels and annotations](ref:labels-and-annotations).
- **Provisioning:** [Use Terraform to provision alerting resources](ref:terraform-provisioning).
- **API management:** [Use the HTTP API to manage alerting resources](ref:http-api-provisioning).
- **Permissions:** [Configure RBAC](ref:configure-rbac).
