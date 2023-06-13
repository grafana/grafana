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

This panel visualization displays an RSS feed. By default, it displays articles from the Grafana Labs blog, and users can change this by entering a different RSS feed URL.

Enter the URL of an RSS in the URL field in the Display section. This panel type does not accept any other queries, and users should not expect to be able to filter or query the RSS feed data in any way using this panel.

In version 8.5, we discontinued the "Use Proxy" option for Grafana news panels. As a result, RSS feeds that are not configured for request by Grafana's frontend (with the appropriate [CORS headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)) may not load.

If you're having trouble loading an RSS feed, you can try rehosting the feed on a different server or using a CORS proxy. A CORS proxy is a tool that allows you to bypass CORS restrictions by making requests to the RSS feed on your behalf. You can find more information about using CORS proxies online.

If you're unable to display an RSS feed using the News panel, you can try using the community RSS/Atom data source plugin [RSS/Atom data source](https://grafana.com/grafana/plugins/volkovlabs-rss-datasource/) in combination with the Dynamic text community panel [Dynamic text](https://grafana.com/grafana/plugins/marcusolsson-dynamictext-panel/). This will allow you to display the RSS feed in a different way.
