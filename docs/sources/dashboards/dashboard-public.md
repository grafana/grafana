---
aliases:
  - /docs/grafana/latest/dashboards/dashboard-manage/
  - /docs/grafana/latest/features/dashboard/dashboards/
title: Public dashboards
weight: 8
---

## Public dashboards

> **Note:** This page describes a feature for Grafana 9.1 and is available as an opt-in alpha feature.

> **Caution:** Making your dashboard public could result in a large number of queries to the datasources used by your dashboard.

Public dashboards allow you to share your Grafana dashboard with anyone. This is useful when you want to expose your
dashboard to the world.

#### Make a dashboard public

- Click on the sharing icon to the right of the dashboard title.
- Click on the Public Dashboard tab.
- Acknowledge the implications of making the dashboard public by checking all the checkboxes.
- Turn on the Enabled toggle.
- Copy the public dashboard link if you'd like to share it. You can always come back later for it.
- Click Save Sharing Configuration to make the dashboard public and make your link live.

#### Revoke access

- Click on the sharing icon to the right of the dashboard title.
- Click on the Public Dashboard tab.
- Turn off the Enabled toggle.
- Anyone with the link will not be able to access the dashboard publicly anymore.

#### Limitations

- Panels that use frontend datasources will fail to fetch data.
- Template variables are currently not supported, but are planned for our beta release.
- The time range is permanently set to the default time range on the dashboard.
