+++
title = "Silence alert notifications"
description = "Silence alert notifications"
keywords = ["grafana", "alerting", "silence", "mute"]
weight = 400
+++

# Silence alert notifications

Grafana allows to you to prevent notifications from one or more alert rules by creating a silence. This silence lasts for a specified window of time.

Silences do not prevent alert rules from being run. They also do not stop alert instances being shown in the user interface. Silences only prevent notifications from being created.

## Add a silence

1. In the Grafana menu hover your cursor over the **Alerting** (bell) icon and select **Silences** (crossed out bell icon).
1. Click the **New Silence** button.
1. Select the start and end date for the **Silence start and end** to indicate when the silence should go into effect and expire.
1. Optionally, update the **Duration**, this will alter the time for the end of silence in the previous step to correspond to the start plus the duration.
1. Enter one or more *Matching Labels* by filling out the **Name** and **Value** fields. Matchers determine which rules the silence will apply to.
1. Enter a **Comment**.
1. Enter the name of the owner in **Creator**.
1. Click **Create**.

## How label matching works

Alert instances that have labels that match all of the "Matching Labels" specified in the silence will be suppressed.

- The **Label** field is the name of the label to match. It is always an equal string match.
- The **Value** field matches against the corresponding value for the specified **Label** name. How it matches depends on the **Regex** and **Equal** checkboxes.
- The **Regex** checkbox specifies if the inputted **Value** should be matched against labels as a regular expression. The regular expression is always anchored. If not selected it is an exact string match.
- The **Equal** checkbox specifies if the match should include alert instances that match or do not match. If not checked, the silence will include alert instances _do not_ match.
