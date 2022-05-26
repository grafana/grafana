---
description: Silences alert notifications
keywords:
  - grafana
  - alerting
  - silence
  - mute
title: Silences
weight: 400
---

# Silences

Use silences to stop notifications from one or more alerting rules. Silences do not prevent alert rules from being evaluated. Nor do they not stop alerting instances from being shown in the user interface. Silences only stop notifications from getting created. A silence lasts for only a specified window of time.

Silences do not prevent alert rules from being evaluated. They also do not stop alert instances being shown in the user interface. Silences only prevent notifications from being created.

You can configure Grafana managed silences as well as silences for an [external Alertmanager data source]({{< relref "../../datasources/alertmanager.md" >}}). For more information, see [Alertmanager]({{< relref "./fundamentals/alertmanager.md" >}}).

> **Note:** Before Grafana v8.2, the configuration of the embedded Alertmanager was shared across organisations. Users of Grafana 8.0 and 8.1 are advised to use the new Grafana 8 Alerts only if they have one organisation. Otherwise, silences for the Grafana managed alerts will be visible by all organizations.

## Add a silence

To add a silence:

1. In the Grafana menu, click the **Alerting** (bell) icon to open the Alerting page listing existing alerts.
1. In the Alerting page, click **Silences** to open the page listing existing contact points.
1. From [Alertmanager]({{< relref "./contact-points.md/#alertmanager" >}}) drop-down, select an external Alertmanager to create and manage silences for the external data source. Otherwise, keep the default option of Grafana.
1. Click **New Silence** to open the Create silence page.
1. In **Silence start and end**, select the start and end date to indicate when the silence should go into effect and expire.
1. Optionally, in **Duration**, specify how long the silence is enforced. This automatically updates the end time in the **Silence start and end** field.
1. In the **Name** and **Value** fields, enter one or more _Matching Labels_. Matchers determine which rules the silence will apply to. For more information, see [Label matching for alert suppression](#label-matching-for-alert-suppression).
1. In **Comment**, add details about the silence.
1. In **Creator**, enter the name of the silence owner or keep the default owner.
1. Click **Create**.

### Label matching for alert suppression

Grafana suppresses notifications only for alerts with labels that match all the "Matching Labels" specified in the silence.

- The **Label** field is the name of the label to match. It must exactly match the label name.
- The **Operator** field is the operator to match against the label value. The available operators are:

  - `=`: Select labels that are exactly equal to the provided string.
  - `!=`: Select labels that are not equal to the provided string.
  - `=~`: Select labels that regex-match the provided string.
  - `!~`: Select labels that do not regex-match the provided string.

- The **Value** field matches against the corresponding value for the specified **Label** name. How it matches depends on the **Operator** value.

1. In the Alerting page, click **Silences** to view the list of existing silences.
1. Find the silence you want to edit, then click **Edit** (pen icon).
1. Make changes, then click **Submit** to save your changes.

## Remove silences

1. In the Alerting page, click **Silences** to view the list of existing silences.
1. Find the silence you want to end, then click **Unsilence**.

> **Note:** Silences that have ended are retained and listed for five days. You cannot remove a silence manually.

## Create a URL to silence form with defaults filled in

When linking to a silence form, provide the default matching labels and comment via `matchers` and `comment` query parameters. The `matchers` parameter requires one more matching labels of the type `[label][operator][value]` joined by a comma while the `operator` parameter can be one of the following: `=` (equals, not regex), `!=` (not equals, not regex), `=~` (equals, regex), `!~` (not equals, regex).

For example, to link to silence form with matching labels `severity=critical` & `cluster!~europe-.*` and comment `Silence critical EU alerts`, create a URL `https://mygrafana/alerting/silence/new?matchers=severity%3Dcritical%2Ccluster!~europe-*&comment=Silence%20critical%20EU%20alert`.

To link to a new silence page for an [external Alertmanager]({{< relref "../../datasources/alertmanager.md" >}}), add a `alertmanager` query parameter with the Alertmanager data source name.
