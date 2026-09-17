---
title: Improve alert rule quality
description: Configure an alert rule quality policy, review findings, and optionally enforce annotation and label requirements for Grafana-managed alert rules.
labels:
  products:
    - enterprise
draft: true
---

<!--
Authoring outline, not finished customer-facing copy.

References:
- Style guide: https://grafana.com/docs/writers-toolkit/write/style-guide/
- Task structure: https://grafana.com/docs/writers-toolkit/structure/topic-types/task/
- Multiple-task template: https://github.com/grafana/writers-toolkit/blob/main/docs/static/templates/multiple-tasks-template.md

Write a short introduction after each heading. For procedures, add a stem sentence,
numbered steps with one action per step, and the expected outcome.
Use sentence case, address the reader as "you", bold UI labels, and use semantic line breaks.

Before publishing: confirm product naming, minimum version, Grafana Cloud availability,
and enablement instructions. Set labels.stage to the confirmed release stage, add cloud
under labels.products if applicable, remove the writing prompts, and remove draft: true.
-->

# Improve alert rule quality

Missing context can make alerts harder to act on.
A runbook URL helps you investigate an issue, and a team label helps you identify who to contact.

With alert rule quality in Grafana, you can:

- Define which labels and annotations are required for Grafana-managed alert rules.
- Find rules with missing required labels or annotations and update them.
- Optionally enforce selected requirements on supported provisioning writes.

## Before you begin

_TODO: List the prerequisites and permissions for the workflow._

<!--
Cover the supported edition and version, feature availability, and how to enable it.
Distinguish permission to view alert rules from permission to change the policy.
Org admins can configure the policy by default; custom roles need alert.rules.quality:write
and the rule-read permission needed by the settings page.
For provisioned rules, the reader also needs access to their source configuration.
-->

## Understand policy scope

_TODO: Explain the scope and the difference between assessing a rule and blocking a write._

<!--
Cover one org-wide policy, Grafana-managed alert rules, and checks for missing, empty,
or whitespace-only annotation and label values. These checks don't validate the content.
Explain that both detect-only and enforced requirements contribute to quality findings.

Use a small assessment-versus-enforcement table if it helps:
- Supported Terraform, kubectl, and provisioning API writes can be enforced.
- Grafana editor writes, file provisioning, and Git Sync aren't enforced.
- Data source-managed and recording rules are outside the assessment scope.

Avoid implying that all provisioned writes are enforced. Explain relevant provenance
exceptions and that policy-read failures skip enforcement, rather than blocking rule management.
-->

## Configure a quality policy

_TODO: Write the procedure for selecting requirements and saving a detect-only policy._

<!--
Verify the navigation to the Alert rule quality settings page against the UI.
Cover built-in annotations, label-key suggestions, adding a label key, and Save.
Explain that new requirements start detect-only and an empty policy checks nothing.
If covering custom annotations, distinguish API-configured keys shown in the UI from
keys the UI can create; don't promise a custom-annotation creation control.
Use one small example, such as requiring runbook_url and team, throughout the page.
-->

## Review alert quality

_TODO: Write the procedure for opening Alert quality and interpreting the results._

<!--
Explain missing-field badges, Detect-only versus Enforced, and the available search filters.
Describe the score as the proportion of assessed rules that meet every configured requirement,
on a scale of 0 to 10. Both modes count; this isn't a score of alert usefulness or severity.
Confirm permission-related visibility when describing the assessed rule set.
Explain that search filters narrow the list, not the score, and distinguish an empty policy
from a configured policy with no findings.
-->

## Resolve quality findings

_TODO: Describe how to add missing values and confirm that the findings are resolved._

<!--
Lead with the provisioned workflow: update the source configuration and reapply it.
Only direct readers to Edit for rules that are editable in Grafana.
Continue the example from the policy configuration section and explain how to reload
or revisit the quality view to check the result; don't promise automatic refresh.
-->

## Optional: Enforce quality requirements

_TODO: Write the procedure for moving selected requirements from detect-only to enforced._

<!--
Cover individual Enforce controls, Enforce all requirements, the mixed state, and Save.
Enforce all changes the currently configured requirements; future additions remain detect-only.
Switching enforcement off keeps the requirement in the policy and in quality assessment.
Removing a requirement stops checking it altogether.
Enabling enforcement doesn't stop existing rules from evaluating.

End with verification on a test rule through a supported as-code write path:
check that a missing enforced value rejects the write, a compliant write succeeds,
and switching back to detect-only permits the write without hiding its quality finding.
-->

## Troubleshoot quality findings and rejected writes

_TODO: Add concise symptom-and-action guidance for the cases readers are likely to encounter._

<!--
Suggested cases: settings aren't visible; a provisioned rule has no Edit action;
a rule still has findings after enforcement is disabled; a write is rejected;
a write succeeds despite a finding; or the quality page can't load the policy or rules.
Explain how to use the rejection's rule and field details to fix the source configuration.
Keep internal deployment procedures and operational runbooks out of this page.
-->

## Next steps

_TODO: Link to relevant provisioning, annotation and label, and alerting-permission documentation._

<!-- Use existing customer documentation rather than duplicating those procedures here. -->
