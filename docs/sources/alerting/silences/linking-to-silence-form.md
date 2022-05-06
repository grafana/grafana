+++
title = "Create URL to link to silence form"
description = "Linking to a silence form"
keywords = ["grafana", "alerting", "silence", "mute"]
weight = 451
aliases = ["/docs/grafana/latest/alerting/unified-alerting/silences/"]
+++

# Create a URL to link to a silence form

When linking to a silence form, provide the default matching labels and comment via `matchers` and `comment` query parameters. The `matchers` parameter requires one more matching labels of the type `[label][operator][value]` joined by a comma while the `operator` parameter can be one of the following: `=` (equals, not regex), `!=` (not equals, not regex), `=~` (equals, regex), `!~` (not equals, regex).

For example, to link to silence form with matching labels `severity=critical` & `cluster!~europe-.*` and comment `Silence critical EU alerts`, create a URL `https://mygrafana/alerting/silence/new?matchers=severity%3Dcritical%2Ccluster!~europe-*&comment=Silence%20critical%20EU%20alert`.

To link to a new silence page for an [external Alertmanager]({{< relref "../../datasources/alertmanager.md" >}}), add a `alertmanager` query parameter with the Alertmanager data source name.
