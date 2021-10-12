+++
title = "Silence alert notifications"
description = "Silence alert notifications"
keywords = ["grafana", "alerting", "silence", "mute"]
weight = 400
+++

# Silence alert notifications

You can use silences to stop notifications from one or more alerting rules. Silences do not prevent alert rules from being evaluated. Nor do they not stop alerting instances from being shown in the user interface. Silences only stop notifications from getting created. A silence lasts for only a specified window of time.

Grafana 8 alerting supports managing of silences for an external Alertmanager. 

## Add a silence

To add a silence:

1. In the Grafana menu, click the **Alerting** (bell) icon to open the Alerting page listing existing alerts.
1. In the Alerting page, click **Silences** to open the page listing existing contact points.
1. From [Alertmanager]({{< relref "../contact-points.md/#alertmanager" >}}) drop down, select an external Alertmanager to create and manage silences for the external data source. Otherwise, keep the default option of Grafana.
1. Click **New Silence** to open the Create silence page.
1. In **Silence start and end**, select the start and end date to indicate when the silence should go into effect and expire.
1. Optionally, in **Duration**, specify how long the silence is enforced. This automatically updates the end time in the  **Silence start and end** field.
1. In the **Name** and **Value** fields, enter one or more _Matching Labels_. Matchers determine which rules the silence will apply to. For more information, see [Label matching for alert suppression](#label-matching-for-alert-suppression).
1. In **Comment**, add details about the silence.
1. In **Creator**, enter the name of the silence owner or keep the default owner.
1. Click **Create**.

### Label matching for alert suppression

Notifications are suppressed only for alerts with labels that match all the "Matching Labels" specified in the silence.

- The **Label** field is the name of the label to match. It must exactly match the label name.
- The **Value** field matches against the corresponding value for the specified **Label** name. How it matches depends on the **Regex** and **Equal** checkboxes.
- The **Regex** checkbox indicates if **Value** should be treated as a regular expression to match against labels. The regular expression is always anchored. If not selected, it is an exact string match.
- The **Equal** checkbox specifies if the match should include alert instances that match. If not checked, the silence includes alerts that _do not_ match.

## Managing silences

1. In the Alerting page, click **Silences** to view the list of existing silences.
1. To end the silence, click the **Unsilence** option next to a listed silence. Silences that have ended are still listed for five days, after which they are automatically removed. You cannot remove a silence manually.
1. Find the silence you want to edit, then click **Edit** (pen icon).
1. Make any changes and click **Submit** to save your changes.

## Create a URL to silence form with defaults filled in

When linking to a silence form, provide the default matching labels and comment via `matchers` and `comment` query parameters. The `matchers` parameter requires one more matching labels of the type `[label][operator][value]` joined by a comma while the `operator` parameter can be one of the following: `=` (equals, not regex), `!=` (not equals, not regex), `=~` (equals, regex), `!~` (not equals, regex).

For example, to link to silence form with matching labels `severity=critical` & `cluster!~europe-.*` and comment `Silence critical EU alerts`, create a URL `https://mygrafana/aleting/silence/new?matchers=severity%3Dcritical%2Ccluster!~europe-*&comment=Silence%20critical%20EU%20alert`.

To link to a new silence page for an [external Alertmanager]({{< relref "../../datasources/alertmanager.md" >}}), add a `alertmanager` query parameter with the Alertmanager data source name.
