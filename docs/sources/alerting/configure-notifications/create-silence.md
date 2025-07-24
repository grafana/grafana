---
aliases:
  - ../silences/create-silence/ # /docs/grafana/<GRAFANA_VERSION>/alerting/silences/create-silence/
  - ../silences/edit-silence/ # /docs/grafana/<GRAFANA_VERSION>/alerting/silences/edit-silence/
  - ../silences/linking-to-silence-form/ # /docs/grafana/<GRAFANA_VERSION>/alerting/silences/linking-to-silence-form/
  - ../silences/remove-silence/ # /docs/grafana/<GRAFANA_VERSION>/alerting/silences/remove-silence/
  - ../unified-alerting/silences/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/silences/
  - ../silences/ # /docs/grafana/<GRAFANA_VERSION>/alerting/silences/
  - ../manage-notifications/create-silence/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/create-silence/
canonical: https://grafana.com/docs/grafana/latest/alerting/configure-notifications/create-silence/
description: Create silences to stop notifications from getting created for a specified window of time
keywords:
  - grafana
  - alerting
  - silence
  - mute
  - active
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure silences
weight: 440
refs:
  configure-alertmanager:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-alertmanager/
  silence-url:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/template-notifications/reference/#alert
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/template-notifications/reference/#alert
  shared-alert-labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/
  shared-notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/
  shared-silences:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-silence/
  shared-mute-timings:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/mute-timings/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/mute-timings/
  alertmanager-architecture:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alertmanager/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/set-up/configure-alertmanager/
---

# Configure silences

Silences stop notifications from being created for a specified time window but do not interrupt alert evaluation. Use them to temporarily prevent alert notifications, such as during incident response or a maintenance window.

{{< admonition type="note" >}}
Silences are assigned to a [specific Alertmanager](ref:alertmanager-architecture) and only suppress notifications for alerts managed by that Alertmanager.
{{< /admonition >}}

## Mute and active timings vs silences

[Mute and active timings](ref:shared-mute-timings) and [silences](ref:shared-silences) are distinct methods to suppress notifications. They do not prevent alert rules from being evaluated or stop alert instances from appearing in the user interface; they only prevent notifications from being created.

The following table highlights the key differences between mute timings and silences.

|            | Mute timing                                                 | Silence                                                          |
| ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| **Setup**  | Created and then added to notification policies             | Matches alerts using labels to determine whether to silence them |
| **Period** | Uses time interval definitions that can repeat periodically | Has a fixed start and end time                                   |

[//]: <> ({{< docs/shared lookup="alerts/mute-timings-vs-silences.md" source="grafana" version="<GRAFANA_VERSION>" >}})

## Add silences

To add a silence, complete the following steps.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Silences**.
1. From the **Alertmanager** dropdown, select an external Alertmanager to create and manage silences for the external data source. Otherwise, keep the default option of Grafana.
1. Click **Create silence** to open the Create silence page.
1. In **Silence start and end**, select the start and end date to indicate when the silence should go into effect and expire.
1. Optionally, in **Duration**, specify how long the silence is enforced. This automatically updates the end time in the **Silence start and end** field.
1. In the **Label** and **Value** fields, enter one or more _Matching Labels_ to determine which alerts the silence applies to.

   {{< collapse title="How label matching works" >}}

Use [labels](ref:shared-alert-labels) and label matchers to link alert rules to [notification policies](ref:shared-notification-policies) and [silences](ref:shared-silences). This allows for a flexible way to manage your alert instances, specify which policy should handle them, and which alerts to silence.

A label matchers consists of 3 distinct parts, the **label**, the **value** and the **operator**.

- The **Label** field is the name of the label to match. It must exactly match the label name.

- The **Value** field matches against the corresponding value for the specified **Label** name. How it matches depends on the **Operator** value.

- The **Operator** field is the operator to match against the label value. The available operators are:

  | Operator | Description                                        |
  | -------- | -------------------------------------------------- |
  | `=`      | Select labels that are exactly equal to the value. |
  | `!=`     | Select labels that are not equal to the value.     |
  | `=~`     | Select labels that regex-match the value.          |
  | `!~`     | Select labels that do not regex-match the value.   |

{{< admonition type="note" >}}
If you are using multiple label matchers, they are combined using the AND logical operator. This means that all matchers must match in order to link a rule to a policy.
{{< /admonition >}}

**Label matching example**

If you define the following set of labels for your alert:

`{ foo=bar, baz=qux, id=12 }`

then:

- A label matcher defined as `foo=bar` matches this alert rule.
- A label matcher defined as `foo!=bar` does _not_ match this alert rule.
- A label matcher defined as `id=~[0-9]+` matches this alert rule.
- A label matcher defined as `baz!~[0-9]+` matches this alert rule.
- Two label matchers defined as `foo=bar` and `id=~[0-9]+` match this alert rule.

**Exclude labels**

You can also write label matchers to exclude labels.

Here is an example that shows how to exclude the label `Team`. You can choose between any of the values below to exclude labels.

| Label  | Operator | Value |
| ------ | -------- | ----- |
| `team` | `=`      | `""`  |
| `team` | `!~`     | `.+`  |
| `team` | `=~`     | `^$`  |

    {{< /collapse >}}

[//]: <> ({{< docs/shared lookup="alerts/how_label_matching_works.md" source="grafana" version="<GRAFANA_VERSION>" >}})

Any matching alerts (in the firing state only) display under **Affected alert instances**.

1. In **Comment**, add details about the silence.
1. Click **Submit**.

## Edit silences

To edit a silence, complete the following steps.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Silences** to view the list of existing silences.
1. Find the silence you want to edit, then click **Edit** (pen icon).
1. Make the desired changes, then click **Submit** to save your changes.

## Remove silences

To remove a silence, complete the following steps.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Silences** to view the list of existing silences.
1. Select the silence you want to end, then click **Unsilence**.

> **Note:** You cannot remove a silence manually. Silences that have ended are retained and listed for five days.

## Rule-specific silences

Rule-specific silences are silences that apply only to a specific alert rule. They're created when you silence an alert rule directly using the **Silence notifications** action in the UI.

As opposed to general silences, rule-specific silence access is tied directly to the alert rule they act on. They can be created manually by including the specific label matcher: `__alert_rule_uid__=<alert rule UID>`.

## URL link to a silence form

Default notification messages often include a link to silence alerts.

In custom notification templates, you can use [`.Alert.SilenceURL`](ref:silence-url) to redirect users to the UI where they can silence the given alert.

If [`.Alert.SilenceURL`](ref:silence-url) doesn’t fit your specific use case, you can also create a custom silence link for your custom templates.

{{< collapse title="Create a custom silence link" >}}

When linking to a silence form, provide the default matching labels and comment via `matcher` and `comment` query parameters. The `matcher` parameter should be in the following format `[label][operator][value]` where the `operator` parameter can be one of the following: `=` (equals, not regular expression), `!=` (not equals, not regular expression), `=~` (equals, regular expression), `!~` (not equals, regular expression).
The URL can contain many query parameters with the key `matcher`.
For example, to link to silence form with matching labels `severity=critical` & `cluster!~europe-.*` and comment `Silence critical EU alerts`, create a URL `https://mygrafana/alerting/silence/new?matcher=severity%3Dcritical&matcher=cluster!~europe-*&comment=Silence%20critical%20EU%20alert`.

To link to a new silence page for an external Alertmanager, add a `alertmanager` query parameter with the Alertmanager data source name.

{{< /collapse >}}

## Inhibition rules

Inhibition rules are supported in the Prometheus Alertmanager. You can [configure a Prometheus Alertmanager](ref:configure-alertmanager) to handle the notification of alerts and suppress notifications via inhibition rules.

Inhibition rules are not currently supported in the Grafana Alertmanager. For tracking the progress of this feature request, follow [this GitHub issue](https://github.com/grafana/grafana/issues/68822).
