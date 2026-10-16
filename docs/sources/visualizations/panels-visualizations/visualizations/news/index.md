---
aliases:
  - ../../../panels/visualizations/news-graph/ # /docs/grafana/next/panels/visualizations/news-graph/
  - ../../news-panel/ # /docs/grafana/next/visualizations/news-panel/
  - ../../../panels-visualizations/visualizations/news/ # /docs/grafana/next/panels-visualizations/visualizations/news/
keywords:
  - grafana
  - news
  - documentation
  - panels
  - news panel
labels:
  products:
    - cloud
    - enterprise
    - oss
description: Configure options for Grafana's news visualization
title: News
weight: 100
---

# News

The news visualization displays an RSS feed. By default, it displays articles from the Grafana Labs blog, but you can change this by entering a different RSS feed URL.

{{< figure src="/static/img/docs/news/news-visualization.png" max-width="1025px" alt="A news visualization showing the latest Grafana news feed" >}}

{{< admonition type="note" >}}
In version 8.5, we discontinued the "Use Proxy" option for Grafana news visualizations. As a result, RSS feeds that are not configured for request by Grafana's frontend (with the appropriate [CORS headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)) may not load.
{{< /admonition >}}

You can use the news visualization to provide regular news and updates to your users.

{{< docs/play title="News Panel" url="https://play.grafana.org/d/cdodkwspaaa68b/" >}}

## Refresh the news feed

The news visualization doesn't have its own refresh interval.
It requests the feed when the dashboard first loads and each time the dashboard refreshes.

To update the articles, do one of the following:

- **Refresh the dashboard manually:** Click the **Refresh dashboard** icon.
- **Set an auto-refresh interval:** Click the drop-down next to the **Refresh dashboard** icon and select an interval. For more information on setting these intervals, refer to [Refresh dashboard](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/use-dashboards/#refresh-dashboard).

The refresh interval applies to the whole dashboard, so pick one that suits your other visualizations as well as your feed.

## Configure a news visualization

After you've created a [dashboard](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/create-dashboard/), enter the URL of an RSS in the **URL** field in the **News** section. This visualization type doesn't accept any other queries, and you shouldn't expect to be able to filter or query the RSS feed data in any way using this visualization.

If you're having trouble loading an RSS feed, you can try re-hosting the feed on a different server or using a CORS proxy. A CORS proxy is a tool that allows you to bypass CORS restrictions by making requests to the RSS feed on your behalf. You can find more information about using CORS proxies online.

If you're unable to display an RSS feed using the news visualization, you can try using the community RSS/Atom data source plugin [RSS/Atom data source](https://grafana.com/grafana/plugins/volkovlabs-rss-datasource/) in combination with the Dynamic text community panel [Dynamic text](https://grafana.com/grafana/plugins/marcusolsson-dynamictext-panel/). This allows you to display the RSS feed in a different way.

## Supported data formats

The news visualization supports RSS and Atom feeds.

## Configuration options

{{< docs/shared lookup="visualizations/config-options-intro.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### Panel options

{{< docs/shared lookup="visualizations/panel-options.md" source="grafana" version="<GRAFANA_VERSION>" >}}

### News options

Use the following options to refine your news visualization:

- **URL** - The URL of the RSS or Atom feed. If you leave the field empty, the Grafana Labs blog is used.
- **Show image** - Controls if the news social image displays beside the text content.
