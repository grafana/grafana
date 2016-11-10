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

This page is dedicated to helping you solve any problem you have getting
Grafana to work. Please review it before opening a new [GitHub
issue](https://github.com/grafana/grafana/issues/new) or asking a
question in the `#grafana` IRC channel on freenode.

## General connection issues

When setting up Grafana for the first time you might experience issues
with Grafana being unable to query Graphite, OpenTSDB or InfluxDB.  You
might not be able to get metric name completion or the graph might show
an error like this:

![](/img/docs/v1/graph_timestore_error.png)

For some types of errors, the `View details` link will show you error
details. For many types of HTTP connection errors, however, there is very
little information. The best way to troubleshoot these issues is use
the [Chrome developer tools](https://developer.chrome.com/devtools/index).
By pressing `F12` you can bring up the chrome dev tools.

![](/img/docs/v1/toubleshooting_chrome_dev_tools.png)

There are two important tabs in the Chrome developer tools: `Network`
and `Console`. The `Console` tab will show you Javascript errors and
HTTP request errors. In the Network tab you will be able to identify the
request that failed and review request and response parameters. This
information will be of great help in finding the cause of the error.

If you are unable to solve the issue, even after reading the remainder
of this troubleshooting guide, you should open a [GitHub support
issue](https://github.com/grafana/grafana/issues).  Before you do that
please search the existing closed or open issues. Also if you need to
create a support issue, screen shots and or text information about the
chrome console error, request and response information from the
`Network` tab in Chrome developer tools are of great help.

### Inspecting Grafana metric requests

![](/img/docs/v1/toubleshooting_chrome_dev_tools_network.png)

After opening the Chrome developer tools for the first time the
`Network` tab is empty. You will need to refresh the page to get
requests to show.  For some type of errors, especially CORS-related,
there might not be a response at all.

