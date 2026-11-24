---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/alert-rule-quality/
description: Use Alert Advisor to define required labels and annotations, review findings, and optionally enforce annotation and label requirements for Grafana-managed alert rules.
keywords:
  - alert advisor
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
title: Improve alert rule quality with Alert Advisor
weight: 600
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

# Improve alert rule quality with Alert Advisor

Alerts are easier to act on when they carry the right context.
A runbook URL helps you investigate an issue, and a team label helps you route your notifications.

Alert Advisor checks your Grafana-managed alert rules against a quality policy of required labels and annotations, so you can find and fix rules that are missing that context.
With Alert Advisor, you can:

- Define which labels and annotations your Grafana-managed alert rules must have.
- Find rules that are missing required labels or annotations and update them.
- Optionally block supported provisioning writes that don't meet selected requirements.
- Give a team its own policy for the folders it owns, so teams can hold their rules to different standards.

## Before you begin

Before you begin, check that you have the following permissions in your Grafana organization:

- **Rule access:** Have permission to view the Grafana-managed alert rules you want to assess.
- **Policy permissions:** To configure the quality policy, have the Admin role in your organization or a role with `alert.rules.quality:write` and `alert.rules:read`.
  This applies to Team policies too: only organization administrators create, edit, and delete them.
- **Rule updates:** To fix findings, have permission to update the affected rules.
  For provisioned rules, you also need access to their source configuration and permission to reapply it.

For more information about alerting permissions and folder access, refer to [Configure RBAC](ref:configure-rbac).

## Understand policy scope

By default, a single quality policy, the _Org policy_, applies to Grafana-managed alert rules across all folders in your organization.
You can also give a team its own policy, called a _Team policy_, which applies to the folders that team owns. Refer to [Team policies](#team-policies).
Data source-managed alert rules, recording rules, and alert rules provided by plugins are excluded.

Alert Advisor reports a finding when a required label or annotation is missing, empty, or contains only whitespace.
The checks do not validate the content itself, they only check for the presence of a particular field.
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

Enforcement applies to provisioned rules created or updated through Terraform and the Alerting provisioning HTTP API, with the following exceptions:

- Provisioning API requests that set the `X-Disable-Provenance` header, including Terraform `grafana_rule_group` resources with `disable_provenance = true`, aren't enforced.
- `kubectl` writes are enforced only when the manifest sets `grafana.app/managedBy` to `kubectl` or `terraform` together with a non-empty `grafana.app/managerId`, or sets `grafana.com/provenance` to `api`.

Writes from the Grafana rule editor aren't enforced, but the resulting rules can still have quality findings.

## Team policies

A Team policy lets a team define what the alert rules in its own folders must carry, without changing the requirements for the rest of the organization.
Team policies are behind the `alerting.ruleQualityTeamPolicies` feature toggle.
While the toggle is off, nothing changes: Grafana evaluates only the Org policy, and the policy drawer shows only the Org policy.

### When a policy applies

A policy follows the folder, not the person writing the rule.
Grafana evaluates policies when an as-code write reaches a folder, whoever makes the write and whichever teams they belong to.

- **Team policy:** Applies to every as-code write into a folder that the team owns.
- **Org policy:** Applies when no owning team of the folder or any of its ancestors has a Team policy, so folders without an owning team are always covered.

A team has at most one Team policy.

### Folder ownership

A team owns a folder when the team is set as the folder's team owner.
Grafana doesn't infer ownership from folder permissions or basic roles. Granting a team access to a folder, or having the Editor or Admin role, doesn't make that team an owner.

Ownership is inherited by subfolders.
A rule in a subfolder is covered by the policies of the teams that own the subfolder and of the teams that own any of its ancestor folders.

A folder can have several owning teams.
A write into such a folder must pass the policies of all of them, so the most restrictive result wins.
One team's lenient policy can't relax another owning team's requirements.

### Team policies and the Org policy

The Org policy is a default, not a minimum.
A team that has a Team policy is held only to the Team policies that apply, and not to the Org policy, for its folders.
A lenient or empty Team policy therefore opts that team's folders out of the Org requirements.

If a team owns a folder but has no Team policy, it doesn't affect which policy applies.

### Rejected writes

A rejected write lists every policy the rule failed, and the missing fields for each rule under each policy.
It shows every missing enforced requirement, including requirements set by other teams that you aren't a member of, so you can fix the source configuration in one pass.
Each failing policy is named: either the Org policy or the policy of a team.
The message also says that organization administrators can change the policy.

Team policies change only which requirements are enforced. Enforcement scope stays the same as described in [Supported enforcement paths](#supported-enforcement-paths):

- Writes from the Grafana rule editor remain exempt.
- Only as-code writers (Terraform, `kubectl`, and the provisioning HTTP API) are enforced.
- Each requirement keeps its own **Enforce** setting inside its policy.

Grafana evaluates policies when a write happens, using the folder's current owners.
Changing a policy or a folder's owners doesn't re-check existing rules.

If Grafana can't resolve a folder's owners or read a policy, the write isn't blocked on that account. Grafana applies the Org policy instead.

### Manage Team policies

In this version, only organization administrators create, edit, and delete policies, Team policies included.
Team admins can't manage their team's policy.

To create a Team policy, follow these steps:

1. Go to **Alerting** > **Alert rules**, select **Alert quality**, and click **Quality policy settings** (the cog icon).
2. Under **Team policies**, click **New team policy**.
3. Select the **Team** the policy is for.
4. Add the required annotations and labels, as described in [Configure a quality policy](#configure-a-quality-policy), and click **Save**.

To edit or delete a Team policy, click **Edit** beside the team's policy. To delete it, click **Delete policy** and confirm.

## Configure a quality policy

Start with detect-only requirements to identify missing information before enabling enforcement.
The following example requires a runbook URL and a `team` label.

The **Quality policy settings** button is visible only if you have the policy permissions listed in [Before you begin](#before-you-begin).

To configure a quality policy, follow these steps:

1. Go to **Alerting** > **Alert rules** and select **Alert quality**.
2. Click **Quality policy settings** (the cog icon) to open the **Quality policy** drawer.
3. Under **Required annotations**, turn on **Runbook URL**.

   You can also require **Summary** and **Description**.

4. Under **Required labels**, enter `team` in **Label keys** and select the matching option.

   You can select keys already used by your rules or add a new key.

5. Keep **Enforce** off for the requirements you add.

   New requirements start in detect-only mode.

6. Click **Save**.

   Grafana displays **Policy saved** to confirm the change.

The saved policy identifies rules with missing or empty `runbook_url` annotations or `team` labels.

A policy with no required annotations or labels checks nothing.

The steps in this section configure the Org policy.
You configure a Team policy the same way, after you select its team. Refer to [Manage Team policies](#manage-team-policies).

## Review alert quality

In Alert Advisor, the **Alert quality** tab lists rules that don't meet your policy and shows an overall quality score.

To review the findings, follow these steps:

1. Go to **Alerting** > **Alert rules** and select **Alert quality**.
2. Review the **Alert quality score** and the number of rules that need attention.
3. Inspect the missing annotations and labels in the **Findings** list.

Each missing field appears as a badge. To check whether a requirement is enforced or detect-only, hover over its badge.

### Policies in the quality check and score

When Team policies are on, the **Alert quality** tab checks each rule against the same policies that apply to writes into its folder.
That is the policy of every team that owns the rule's folder or one of its ancestors, or the Org policy when none of those teams has a policy.
The findings and the score use those policies, so a rule in a team's folder isn't reported for requirements that only the Org policy sets.
The tab shows the policies for the rules you can view and doesn't change what Grafana enforces on a write.

An empty Team policy leaves its rules with nothing to miss, so they count as meeting the policy.

### Understand the score

The score represents the proportion of assessed rules that meet every configured requirement, on a scale of 0 to 10.
For example, if 8 of 10 rules meet the policy, the score is 8.0.
Grafana rounds the score to one decimal place.

The score measures compliance with your policy, not alert accuracy, severity, or noise. Both detect-only and enforced requirements count toward the score.

Your permissions determine which rules you can view and assess.
Search filters change the findings' list, not the score or the total rule count.
Grafana also displays 10.0 when there are no rules to assess, so check the rule count alongside the score.

## Resolve quality findings

Add meaningful values for the missing fields in each rule.
For the example policy, set `runbook_url` to the rule's runbook URL and `team` to the owning team's name.

Changing label values can affect notification routing.
Choose values that match your team's [notification policies](ref:notification-policies).

### Update provisioned rules

For provisioned rules, make changes in the source configuration so they remain part of your provisioning workflow.

To resolve a finding on a provisioned rule, follow these steps:

1. Locate the rule in its source configuration, using the rule name, folder, and group shown in **Alert quality**.
2. Add values for the missing annotations and labels.
3. Reapply the configuration through your usual provisioning workflow.
4. Reload the **Alert quality** page and check the rule's findings.

A rule disappears from the findings list when it meets every configured requirement.
If other required fields are still missing, the rule remains in the list with those findings.

### Update rules in Grafana

For rules that you can edit in Grafana, use the **Edit** action on the quality page.

To resolve a finding in the rule editor, follow these steps:

1. Click **Edit** for the affected rule.
2. Fill in the missing annotations and labels in the rule editor.
3. Click **Save**.
4. Return to **Alert quality** and reload the page to check the findings.

## Optional: Enforce quality requirements

After reviewing and resolving findings, enable enforcement for the requirements you want to apply to supported provisioning writes.
You can enforce selected requirements while keeping others detect-only.

To enable enforcement, follow these steps:

1. On the **Alert quality** page, click **Quality policy settings** (the cog icon) to open the **Quality policy** drawer.
2. Turn on **Enforce** beside each requirement you want to enforce.

   For example, enforce `team` while keeping **Runbook URL** detect-only.
   To enforce all currently configured requirements, turn on **Enforce all requirements** instead.

3. Click **Save**.

   Grafana displays **Policy saved** to confirm the change.

### Disable enforcement or remove a requirement

To return a requirement to detect-only, turn off its **Enforce** control (or **Enforce all requirements**, if every requirement is enforced) and click **Save**.
The requirement remains in the policy and continues to affect the quality score.

To stop checking a field altogether, remove its requirement instead: turn off its switch under **Required annotations**, or remove its key from **Label keys**. Then click **Save**.

## Troubleshoot quality findings and rejected writes

Use the following guidance when you can't access the feature, resolve a finding, or apply a rule change.

| Symptom                                                                    | Action                                                                                                                                                                                    |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Alert quality** or the **Quality policy settings** button isn't visible. | Ask your stack administrator to check your [permissions](#before-you-begin) and the feature's availability in your stack.                                                                 |
| A rule has no **Edit** action.                                             | If it has a **Provisioned** badge, update its source configuration. Otherwise, check your permission to update rules in that folder.                                                      |
| Grafana reports that no quality policy is configured.                      | Add at least one requirement in the **Quality policy** drawer and click **Save**. An empty policy doesn't assess any fields.                                                              |
| No findings match your search, but the score is below 10.0.                | Clear **Search** to view all findings. Search filters don't change the score.                                                                                                             |
| A finding remains after enforcement is disabled.                           | Detect-only requirements still produce findings. Fill in the missing value or remove the requirement from the policy.                                                                     |
| A provisioning write is rejected by the quality policy.                    | Use the rule and field details in the error to update the source configuration, then reapply it.                                                                                          |
| A rejection names a team policy that you didn't expect.                    | The write goes to a folder, or a subfolder of a folder, owned by that team. Add the fields every named policy lists, or ask an organization administrator to change the policy.           |
| A rule in a team's folder isn't checked against the Org policy.            | The team has its own policy, which replaces the Org policy for its folders. Check that `alerting.ruleQualityTeamPolicies` is on and review the team's policy.                             |
| A write succeeds despite a quality finding.                                | Check that the requirement is enforced and the policy is saved. Confirm that the write uses a [supported enforcement path](#supported-enforcement-paths) and isn't one of its exceptions. |

## Next steps

Use these guides to improve rule context, manage rules as code, and configure access:

- **Rule context:** [Labels and annotations](ref:labels-and-annotations).
- **Provisioning:** [Use Terraform to provision alerting resources](ref:terraform-provisioning).
- **API management:** [Use the HTTP API to manage alerting resources](ref:http-api-provisioning).
- **Permissions:** [Configure RBAC](ref:configure-rbac).
