+++
title = "Silence alert notifications"
description = "Silence alert notifications"
keywords = ["grafana", "alerting", "silence", "mute"]
weight = 400
+++

# Silence alert notifications

Grafana allows to you to prevent notifications from one or more alert rules by creating a silence. This silence lasts for a specified window of time.

Silences do not prevent alert rules from being evaluated. They also do not stop alert instances being shown in the user interface. Silences only prevent notifications from being created.

## Add a silence

To add a silence:

1. In the Grafana menu, hover your cursor over the **Alerting** (bell) icon and then select **Silences** (crossed out bell icon).
1. Click the **New Silence** button.
1. Select the start and end date in **Silence start and end** to indicate when the silence should go into effect and expire.
1. Optionally, update the **Duration** to alter the time for the end of silence in the previous step to correspond to the start plus the duration.
1. Enter one or more *Matching Labels* by filling out the **Name** and **Value** fields. Matchers determine which rules the silence will apply to.
1. Enter a **Comment**.
1. Enter the name of the owner in **Creator**.
1. Click **Create**.

## How label matching works

Alert instances that have labels that match all of the "Matching Labels" specified in the silence will have their notifications suppressed.

- The **Label** field is the name of the label to match. It must exactly match the label name.
- The **Value** field matches against the corresponding value for the specified **Label** name. How it matches depends on the **Regex** and **Equal** checkboxes.
- The **Regex** checkbox specifies if the inputted **Value** should be matched against labels as a regular expression. The regular expression is always anchored. If not selected it is an exact string match.
- The **Equal** checkbox specifies if the match should include alert instances that match or do not match. If not checked, the silence includes alert instances _do not_ match.

## Viewing and editing silences

1. In the Grafana menu hover your cursor over the **Alerting** (bell) icon, then select **Silences** (crossed out bell icon).
1. To end the silence, click the **Unsilence** option next to the listed silence. Silences that have ended are still listed and are automatically removed after 5 days. There is no method for manual removal.
1. To edit a silence, click the pencil icon next to the listed silence. Edit the silence using instructions on how to create a silence.
1. Click **Submit** to save your changes.
