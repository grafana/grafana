---
aliases:
  - /docs/grafana/latest/dashboards/dashboard-manage/
  - /docs/grafana/latest/features/dashboard/dashboards/
title: Public dashboards
weight: 8
---

## Public dashboards

> **Note:** This is an opt-in alpha feature.

> **Caution:** Making your dashboard public could result in a large number of queries to the datasources used by your dashboard.
> This can be mitigated by utilizing the enterprise [caching](https://grafana.com/docs/grafana/latest/enterprise/query-caching/) and/or rate limiting features.

Public dashboards allow you to share your Grafana dashboard with anyone. This is useful when you want to expose your
dashboard to the world.

#### Security implications of making your dashboard public

- Anyone with the URL can access the dashboard.
- Public dashboards are read-only.
- Arbitrary queries **cannot** be run against your datasources through public dashboards. Public dashboards can only execute the
  queries stored on the original dashboard.

#### Enable the feature

Add the `publicDashboards` feature toggle to your `custom.ini` file.

> **Note:** For Grafana Cloud, you will need to contact support to have the feature enabled.

#### Make a dashboard public

- Click on the sharing icon to the right of the dashboard title.
- Click on the Public Dashboard tab.
- Acknowledge the implications of making the dashboard public by checking all the checkboxes.
- Turn on the Enabled toggle.
- Click `Save Sharing Configuration` to make the dashboard public and make your link live.
- Copy the public dashboard link if you'd like to share it. You can always come back later for it.

#### Revoke access

- Click on the sharing icon to the right of the dashboard title.
- Click on the Public Dashboard tab.
- Turn off the Enabled toggle.
- Click `Save Sharing Configuration` to save your changes.
- Anyone with the link will not be able to access the dashboard publicly anymore.

#### Limitations

- Panels that use frontend datasources will fail to fetch data.
- Template variables are currently not supported, but are planned to be in the future.
- The time range is permanently set to the default time range on the dashboard. If you update the default time range for a dashboard, it will be reflected in the public dashboard.

We are excited to share this enhancement with you and we’d love your feedback! Please check out the [Github](https://github.com/grafana/grafana/discussions/49253) discussion and join the conversation.
