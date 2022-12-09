---
aliases:
  - ../../panels/visualizations/news-graph/
  - ../../visualizations/news-panel/
keywords:
  - grafana
  - news
  - documentation
  - panels
  - news panel
title: News
weight: 800
---

## News

This panel visualization displays an RSS feed. By default, it displays articles from the Grafana Labs blog.

Enter the URL of an RSS in the URL field in the Display section. This panel type does not accept any other queries.

In version 8.5, we discontinued the "Use Proxy" option for Grafana news panels. As a result, RSS feeds that are not configured for request by Grafana's frontend (with the appropriate [CORS headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)) may not load.

If the RSS feed you're trying to display fails to load, consider rehosting the RSS feed or prefixing the RSS URL with your own "CORS proxy". Alternatively, you can use the community [RSS/Atom data source](https://grafana.com/grafana/plugins/volkovlabs-rss-datasource/) in combination with the [Dynamic text](https://grafana.com/grafana/plugins/marcusolsson-dynamictext-panel/) community panel to display the RSS feed.
