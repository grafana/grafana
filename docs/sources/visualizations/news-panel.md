+++
title = "News"
keywords = ["grafana", "news", "documentation", "panels", "news panel"]
aliases = ["/docs/grafana/latest/panels/visualizations/news-graph/"]
weight = 800
+++

## News

This panel visualization displays an RSS feed. By default, it displays articles from the Grafana Labs blog.

Enter the URL of an RSS in the URL field in the Display section. This panel type does not accept any other queries.

Some RSS feeds may not load if they're not configured to be requested by Grafana's frontend (with the appropriate [CORS headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)). Previous versions of the News panel had a "Use Proxy" option to circumvent this via an external service, which has since been shut down.

If the RSS feed you're trying to display fails to load, consider rehosting the RSS feed yourself, or prefixing the RSS url with your own "CORS proxy". Alternatively, you can use the community [RSS/Atom data source](https://grafana.com/grafana/plugins/volkovlabs-rss-datasource/) in combination with the [Dynamic text](https://grafana.com/grafana/plugins/marcusolsson-dynamictext-panel/) community panel.
