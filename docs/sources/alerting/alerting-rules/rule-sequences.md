---
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/rule-sequences/
description: Configure rule sequences to evaluate Grafana-managed recording rules and alert rules in a defined order at a shared interval.
keywords:
  - grafana
  - alerting
  - recording rules
  - rule sequences
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure rule sequences
menuTitle: Rule sequences
weight: 450
---

{{< docs/public-preview product="Rule sequences" >}}

# Configure rule sequences

Use rule sequences in Grafana Alerting when a recording rule or alert rule depends on the results of another recording rule. A rule sequence references existing Grafana-managed rules and defines their evaluation order and shared evaluation interval.

You can create and manage rule sequences through the Grafana Alerting API or Terraform. The API uses `v0alpha1` and is subject to change.

## Before you begin

Before you create a sequence, ensure you have the following:

- **Grafana version:** Use Grafana Cloud or Grafana OSS or Enterprise 13.1 or later.
- **Rules:** Create at least one Grafana-managed recording rule and any dependent recording rules or alert rules. Place all the rules in the same folder.
- **Recording rule storage:** Ensure your recording rules write to a Prometheus-compatible data source. In Grafana Cloud, rules without an explicit target write to your managed Prometheus data source by default. In self-managed Grafana, configure a target data source or a default target. For details, refer to [Create Grafana-managed recording rules](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/).
- **API access:** Use an authenticated account with permission to manage alert rules in the folder. For authentication options, refer to [Authentication options for the HTTP API](/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/authentication/).

## Understand evaluation order

For each evaluation interval, Grafana evaluates the rules in two stages:

1. Evaluate the recording rules in the order listed in `spec.recordingRules`.
1. Evaluate the alert rules in the order listed in `spec.alertingRules`, after the recording rules.

For example, you can evaluate a recording rule that calculates a request rate, then a recording rule that uses that metric to calculate an error ratio, and then an alert rule that queries the error ratio.

The sequence's `spec.trigger.interval` sets the evaluation interval for every rule in the sequence, overriding each rule's individual interval while it belongs to the sequence. You continue to manage each rule's queries, expressions, and other settings separately.

Rules outside the sequence retain their existing evaluation behavior. A sequence defines evaluation order, not a general-purpose organizational group.

Evaluation order doesn't guarantee that a preceding rule produces new data. Grafana continues to the next rule even if a recording rule fails or returns no data. A dependent rule can query older data or receive no data, depending on its query and the target data source. Configure its error and no-data handling accordingly.

Even when a recording rule succeeds, its samples might not be available to query immediately. Grafana waits for the write request to complete but doesn't check whether the target data source can return the samples before it evaluates the next rule. A sequence guarantees evaluation order, not read-after-write consistency.

## Create a sequence with the API

Create a `RuleSequence` resource that references the rules by name. For alert rules and recording rules, use each resource's `metadata.name`, which corresponds to its rule UID.

Send a `POST` request to `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/{namespace}/rulesequences` with the `Content-Type: application/json` header and the following body:

```json
{
  "apiVersion": "rules.alerting.grafana.app/v0alpha1",
  "kind": "RuleSequence",
  "metadata": {
    "name": "request-error-sequence",
    "namespace": "<NAMESPACE>",
    "annotations": {
      "grafana.app/folder": "<FOLDER_UID>"
    }
  },
  "spec": {
    "trigger": {
      "interval": "1m"
    },
    "recordingRules": [{ "name": "<REQUEST_RATE_RULE_UID>" }, { "name": "<ERROR_RATIO_RULE_UID>" }],
    "alertingRules": [{ "name": "<ALERT_RULE_UID>" }]
  }
}
```

Replace the placeholders with the following values:

- **`<NAMESPACE>`:** Use your Grafana instance's namespace in both the request path and body. For namespace formats, refer to [API structure in Grafana](/docs/grafana/<GRAFANA_VERSION>/developer-resources/api-reference/http-api/apis/#namespace-namespace).
- **`<FOLDER_UID>`:** Use the UID of the folder that contains all referenced rules.
- **`<REQUEST_RATE_RULE_UID>`:** Use the UID of the recording rule that calculates the request rate.
- **`<ERROR_RATIO_RULE_UID>`:** Use the UID of the recording rule that queries the request-rate metric and calculates the error ratio.
- **`<ALERT_RULE_UID>`:** Use the UID of the alert rule that queries the error-ratio metric.

The example evaluates the three rules in that order every minute. Configure the dependent rules to query the metrics produced by the preceding recording rules. Adding a rule to a sequence doesn't change its query or automatically connect it to another rule's output.

To retrieve the sequence, send a `GET` request to `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/{namespace}/rulesequences/{name}`. Use `request-error-sequence` as `{name}` for this example.

## Create a sequence with Terraform

Use the `grafana_apps_rules_rulesequence_v0alpha1` resource to manage a sequence in Terraform. Set `metadata.folder_uid` to the folder that contains the rules, and reference their UIDs in `spec.recording_rules` and `spec.alerting_rules`.

For a complete example and resource fields, refer to [grafana_apps_rules_rulesequence_v0alpha1](https://registry.terraform.io/providers/grafana/grafana/latest/docs/resources/apps_rules_rulesequence_v0alpha1).

## Update or remove a sequence

To change the order, membership, or interval through the API, retrieve the current sequence and send the updated resource with a `PUT` request to `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/{namespace}/rulesequences/{name}`. Preserve its `metadata.resourceVersion` from the response.

To remove a sequence, send a `DELETE` request to `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/{namespace}/rulesequences/{name}`. Deleting a sequence doesn't delete the rules it references.

After Grafana picks up the change, rules removed from a sequence return to their stored evaluation interval and group settings.

If you manage the sequence with Terraform, update or remove it in your Terraform configuration instead.

## Sequence constraints

When you create or update a sequence, follow these constraints:

- **Recording rules:** Include at least one recording rule. Alert rules are optional.
- **Folder:** Place the sequence and all referenced rules in the same folder.
- **Membership:** Reference each rule only once. A rule can belong to only one sequence.
- **Rule changes:** Remove a rule from its sequence before you delete the rule or move it to another folder.
- **Interval:** Use a positive interval that's an integer multiple of your instance's base evaluation interval. For example, with a base interval of `10s`, you can use `10s`, `30s`, or `1m`, but not `15s`. The API rejects invalid intervals instead of adjusting them.
- **Self-managed evaluation jitter:** In Grafana OSS and Enterprise, keep the `jitterAlertRulesWithinGroups` feature toggle disabled when you use rule sequences. This toggle disables sequential evaluation and is disabled by default.

## Related resources

For more information about recording rules and evaluation behavior, refer to the following resources:

- [Create Grafana-managed recording rules](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-recording-rules/create-grafana-managed-recording-rules/)
- [How rules are evaluated within a group](/docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/evaluation-within-a-group/)
