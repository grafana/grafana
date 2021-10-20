+++
title = "Silence alert notifications"
description = "Silence alert notifications"
keywords = ["grafana", "alerting", "silence", "mute"]
weight = 400
+++

# Silence alert notifications

Grafana allows to you to prevent notifications from one or more alert rules by creating a silence. This silence lasts for a specified window of time.

Silences do not prevent alert rules from being evaluated. They also do not stop alert instances being shown in the user interface. Silences only prevent notifications from being created.

Grafana alerting UI allows you to configure silences for the Grafana managed alerts (handled by the embedded Alertmanager) as well as silences for an [external Alertmanager if one is configured]({{< relref "../../datasources/alertmanager.md" >}}), using the Alertmanager dropdown.

> **Note:** Currently the configuration of the embedded Alertmanager is shared across organisations. Therefore users are advised to use the new Grafana 8 Alerts only if they have one organisation otherwise silences for the Grafana managed alerts will be visible by all organizations.

## Add a silence

To add a silence:

1. In the Grafana menu, hover your cursor over the **Alerting** (bell) icon and then select **Silences** (crossed out bell icon).
1. Click the **New Silence** button.
1. Select the start and end date in **Silence start and end** to indicate when the silence should go into effect and expire.
1. Optionally, update the **Duration** to alter the time for the end of silence in the previous step to correspond to the start plus the duration.
1. Enter one or more _Matching Labels_ by filling out the **Name** and **Value** fields. Matchers determine which rules the silence will apply to.
1. Enter a **Comment**.
1. Enter the name of the owner in **Creator**.
1. Click **Create**.

## How label matching works

Alert instances that have labels that match all of the "Matching Labels" specified in the silence will have their notifications suppressed.

- The **Label** field is the name of the label to match. It must exactly match the label name.
- The **Operator** field is the operator to match against the label value. The available operators are:

  - `=`: Select labels that are exactly equal to the provided string.
  - `!=`: Select labels that are not equal to the provided string.
  - `=~`: Select labels that regex-match the provided string.
  - `!~`: Select labels that do not regex-match the provided string.

- The **Value** field matches against the corresponding value for the specified **Label** name. How it matches depends on the **Operator** value.

## Viewing and editing silences

1. In the Grafana menu hover your cursor over the **Alerting** (bell) icon, then select **Silences** (crossed out bell icon).
1. To end the silence, click the **Unsilence** option next to the listed silence. Silences that have ended are still listed and are automatically removed after 5 days. There is no method for manual removal.
1. To edit a silence, click the pencil icon next to the listed silence. Edit the silence using instructions on how to create a silence.
1. Click **Submit** to save your changes.

## Manage silences for an external Alertmanager

Grafana alerting UI supports managing external Alertmanager silences. Once you add an [Alertmanager data source]({{< relref "../../datasources/alertmanager.md" >}}), a dropdown displays at the top of the page where you can select either `Grafana` or an external Alertmanager as your data source.

## Create a URL to silence form with defaults filled in

When linking to a silence form, provide the default matching labels and comment via `matchers` and `comment` query parameters. The `matchers` parameter requires one more matching labels of the type `[label][operator][value]` joined by a comma while the `operator` parameter can be one of the following: `=` (equals, not regex), `!=` (not equals, not regex), `=~` (equals, regex), `!~` (not equals, regex).

For example, to link to silence form with matching labels `severity=critical` & `cluster!~europe-.*` and comment `Silence critical EU alerts`, create a URL `https://mygrafana/alerting/silence/new?matchers=severity%3Dcritical%2Ccluster!~europe-*&comment=Silence%20critical%20EU%20alert`.

To link to a new silence page for an [external Alertmanager]({{< relref "../../datasources/alertmanager.md" >}}), add a `alertmanager` query parameter with the Alertmanager data source name.
