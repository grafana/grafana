---
aliases:
  - ../unified-alerting/silences/
description: Linking to a silence form
keywords:
  - grafana
  - alerting
  - silence
  - mute
title: Create URL to link to silence form
weight: 451
---

# Create a URL to link to a silence form

When linking to a silence form, provide the default matching labels and comment via `matcher` and `comment` query parameters. The `matcher` parameter should be in the following format `[label][operator][value]` where the `operator` parameter can be one of the following: `=` (equals, not regex), `!=` (not equals, not regex), `=~` (equals, regex), `!~` (not equals, regex).
The URL can contain many query parameters with the key `matcher`.
For example, to link to silence form with matching labels `severity=critical` & `cluster!~europe-.*` and comment `Silence critical EU alerts`, create a URL `https://mygrafana/alerting/silence/new?matcher=severity%3Dcritical&matcher=cluster!~europe-*&comment=Silence%20critical%20EU%20alert`.

To link to a new silence page for an [external Alertmanager]({{< relref "../../datasources/alertmanager/" >}}), add a `alertmanager` query parameter with the Alertmanager data source name.
