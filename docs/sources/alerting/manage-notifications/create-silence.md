---
aliases:
  - ../silences/create-silence/
  - ../silences/edit-silence/
  - ../silences/linking-to-silence-form/
  - ../silences/remove-silence/
  - ../unified-alerting/silences/
description: Add silence alert notification
keywords:
  - grafana
  - alerting
  - silence
  - mute
title: Manage silences
weight: 410
---

# Manage silences

Silences stop notifications from getting created and last for only a specified window of time.

**Note that inhibition rules are not supported in the Grafana Alertmanager.**

## Add silences

To add a silence, complete the following steps.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Silences**.
1. From the **Alertmanager** dropdown, select an external Alertmanager to create and manage silences for the external data source. Otherwise, keep the default option of Grafana.
1. Click **Create silence** to open the Create silence page.
1. In **Silence start and end**, select the start and end date to indicate when the silence should go into effect and expire.
1. Optionally, in **Duration**, specify how long the silence is enforced. This automatically updates the end time in the **Silence start and end** field.
1. In the **Label** and **Value** fields, enter one or more _Matching Labels_. Matchers determine which rules the silence will apply to.
1. In **Comment**, add details about the silence.
1. Click **Submit**.

## Edit silences

To edit a silence, complete the following steps.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Silences** to view the list of existing silences.
1. Find the silence you want to edit, then click **Edit** (pen icon).
1. Make the desired changes, then click **Submit** to save your changes.

## Create a URL to link to a silence form

When linking to a silence form, provide the default matching labels and comment via `matcher` and `comment` query parameters. The `matcher` parameter should be in the following format `[label][operator][value]` where the `operator` parameter can be one of the following: `=` (equals, not regex), `!=` (not equals, not regex), `=~` (equals, regex), `!~` (not equals, regex).
The URL can contain many query parameters with the key `matcher`.
For example, to link to silence form with matching labels `severity=critical` & `cluster!~europe-.*` and comment `Silence critical EU alerts`, create a URL `https://mygrafana/alerting/silence/new?matcher=severity%3Dcritical&matcher=cluster!~europe-*&comment=Silence%20critical%20EU%20alert`.

To link to a new silence page for an external Alertmanager, add a `alertmanager` query parameter with the Alertmanager data source name.

## Remove silences

To remove a silence, complete the following steps.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Silences** to view the list of existing silences.
1. Select the silence you want to end, then click **Unsilence**.

> **Note:** You cannot remove a silence manually. Silences that have ended are retained and listed for five days.

## Useful links

[Aggregation operators](/docs/prometheus/latest/querying/operators/#aggregation-operators)
