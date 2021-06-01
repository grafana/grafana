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
1. Enter a date for the **Start of Silence** to indicate when the silence should go into effect.
1. Enter a date for the **End of Silence** to indicate when the silence should expire.
1. **Duration** ?
1. Enter one or more *matchers* by filling out the **Name** and **Value** fields. Matchers determine which rules the silence will apply to.
1. Enter a **Comment**.
1. Enter the name of the owner in **Creator**.
1. Click **Create**.

## How Matchers Work