---
description: Feature and improvement highlights for Grafana v11.2
keywords:
  - grafana
  - new
  - documentation
  - '11.2'
  - release notes
labels:
products:
  - cloud
  - enterprise
  - oss
title: What's new in Grafana v11.2
weight: -44
---

<!-- vale GoogleWe = NO -->
<!-- vale We = NO -->

# What’s new in Grafana v11.2

Welcome to Grafana 11.2!

<!-- {{< youtube id="" >}} -->

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v11.2, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v11.2/).

## Dashboards and visualizations

### Scenes-powered Dashboards is generally available

<!-- #grafana-dashboards -->

_Generally available in all editions of Grafana_

For the past few months we've been working on a major update of our **Dashboards** architecture and migrated it to the Scenes library. This migration provides us with more stable, dynamic, and flexible dashboards as well as setting the foundation for what we envision the future of Grafana dashboards will be. Here are two of the improvements that are being introduced as part of this work:

#### Edit mode

It can be difficult to efficiently navigate through the visually cluttered options during the dashboard editing process. With the introduction of the edit mode, we aim to provide an easier way to discover and interact with the dashboard edit experience.

#### Fixed positioning of template variables and time picker

We moved the time picker into the dashboard canvas and now, together with template variables, it will stick to the top as you scroll through your dashboard. This has historically been a very [requested feature](https://github.com/grafana/grafana/issues/11166) that we're very happy to be able to finally roll out!

#### Timezone parameter in Grafana URL

We've added a new URL parameter `tz`. This allows sharing dashboards with a selected time zone, ensuring that the receiver views it in the intended time zone regardless of their local settings.

#### Kiosk mode displays dashboard controls

When playing a playlist or displaying a dashboard in full screen, controls are now shown by default. These controls include the time and refresh picker, variables, annotations, and links.

If you prefer to hide these controls during playlist playback, new configuration options are available when starting a playlist. You can choose which controls to display while the playlist is running.

For configuring controls outside of playlist playback, you can use the following URL parameters:

- `_dash.hideTimePicker`: Hides the time and refresh picker
- `_dash.hideVariables`: Hides variables and annotations controls
- `_dash.hideLinks`: Hides dashboard links

#### Known limitations

- The [variable usage check](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/inspect-variable/) is not yet available.
<!-- Replace this link with Cloud version in WNIC and maybe remove the general docs link -->
- Editing a panel:

  - The **Library panels** tab is not available anymore. You can replace a library panel from the panel menu.
  - The **Overrides** tab is missing in panel options (coming in Grafana v11.2.0). Overrides are shown at the bottom of the option list.
  - The drop-down to collapse the visualization picker is missing (coming in Grafana v11.2.0).

- Share button is not visible when edit mode is enabled (coming in Grafana v11.2.0).

If you want to learn more, in detail, about all the improvements we've made, don't miss our blog post.

{{< youtube id="kcKwBhvrsHc" >}}

## Explore

### Logs filtering and pinning in Explore content outline

<!-- Haris Rozajac -->

_Generally available in all editions of Grafana_

<!-- Fix availability tags in WNIC-->

Grafana Explore now allows for logs filtering and pinning in content outline.

**Filtering Logs:** All log levels are now automatically available in the content outline. You can filter by log level, currently supported for Elasticsearch and Loki data sources. To select multiple filters, hold down the command key on Mac or the control key on Windows while clicking.

**Pinning Logs:** The new pinning feature allows users to pin logs to the content outline, making them easily accessible for quick reference during investigations. To pin a log, hover over a log in the logs panel and click on the _Pin to content outline_ icon in the log row menu. Clicking on a pinned log will open the log context modal, showing the log highlighted in context with other logs. From here, you can also open the log in split mode to preserve the time range in the left pane while having the time range specific to that log in the right pane.
