+++
title = "Troubleshooting"
description = "Guide to troubleshooting Grafana problems"
keywords = ["grafana", "troubleshooting", "documentation", "guide"]
type = "docs"
[menu.docs]
parent = "admin"
weight = 8
+++


# Troubleshooting

## visualization & query issues

The most common problems are related to the query & response from you data source. Even if it looks
like a bug or visualization issue in Grafana it is 99% of time a problem with the data source query or
the data source response.

So make sure to check the query sent and the raw response, learn how in this guide: [How to troubleshoot metric query issues](https://community.grafana.com/t/how-to-troubleshoot-metric-query-issues/50)

## Logging

If you encounter an error or problem it is a good idea to check the grafana server log. Usually
located at `/var/log/grafana/grafana.log` on unix systems or in `<grafana_install_dir>/data/log` on
other platforms & manual installs.

You can enable more logging by changing log level in you grafana configuration file.

## FAQ

Checkout the [FAQ](https://community.grafana.com/c/howto/faq) section on our community page for frequently
asked questions.

