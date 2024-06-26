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
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Configure silences
weight: 440
refs:
  alert-labels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/
  notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/
  silences:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-silence/
---

# Configure silences

Silences stop notifications from getting created and last for only a specified window of time.

{{< admonition type="note" >}}

- Inhibition rules are not supported in the Grafana Alertmanager.
- The preview of silenced alerts only applies to alerts in firing state.
  {{< /admonition >}}

## Add silences

To add a silence, complete the following steps.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Silences**.
1. From the **Alertmanager** dropdown, select an external Alertmanager to create and manage silences for the external data source. Otherwise, keep the default option of Grafana.
1. Click **Create silence** to open the Create silence page.
1. In **Silence start and end**, select the start and end date to indicate when the silence should go into effect and expire.
1. Optionally, in **Duration**, specify how long the silence is enforced. This automatically updates the end time in the **Silence start and end** field.
1. In the **Label** and **Value** fields, enter one or more _Matching Labels_. Matchers determine which rules the silence will apply to. Any matching alerts (in firing state) will show in the **Silenced alert instances** field

   {{< docs/shared lookup="alerts/how_label_matching_works.md" source="grafana" version="<GRAFANA_VERSION>" >}}

1. In **Comment**, add details about the silence.
1. Click **Submit**.

## Edit silences

To edit a silence, complete the following steps.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Silences** to view the list of existing silences.
1. Find the silence you want to edit, then click **Edit** (pen icon).
1. Make the desired changes, then click **Submit** to save your changes.

## Create a URL to link to a silence form

When linking to a silence form, provide the default matching labels and comment via `matcher` and `comment` query parameters. The `matcher` parameter should be in the following format `[label][operator][value]` where the `operator` parameter can be one of the following: `=` (equals, not regular expression), `!=` (not equals, not regular expression), `=~` (equals, regular expression), `!~` (not equals, regular expression).
The URL can contain many query parameters with the key `matcher`.
For example, to link to silence form with matching labels `severity=critical` & `cluster!~europe-.*` and comment `Silence critical EU alerts`, create a URL `https://mygrafana/alerting/silence/new?matcher=severity%3Dcritical&matcher=cluster!~europe-*&comment=Silence%20critical%20EU%20alert`.

To link to a new silence page for an external Alertmanager, add a `alertmanager` query parameter with the Alertmanager data source name.

## Remove silences

To remove a silence, complete the following steps.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Silences** to view the list of existing silences.
1. Select the silence you want to end, then click **Unsilence**.

> **Note:** You cannot remove a silence manually. Silences that have ended are retained and listed for five days.

## Rule-specific silences

Rule-specific silences are silences that apply only to a specific alert rule. They are created when you silence an alert rule directly using the `Silence notifications` action in the UI.

{{< admonition type="note" >}}
As opposed to general silences, rule-specific silence access is tied directly to the alert rule they act on. They can be created manually by including the specific label matcher: `__alert_rule_uid__=<alert rule UID>`.
{{< /admonition >}}

## Useful links

[Aggregation operators](https://prometheus.io/docs/prometheus/latest/querying/operators/#aggregation-operators)
