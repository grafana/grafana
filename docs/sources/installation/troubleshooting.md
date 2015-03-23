page_title: Troubleshooting
page_description: Troubleshooting
page_keywords: grafana, support, documentation

# Troubleshooting

This page is dedicated to helping you solve any problem you have getting Grafana to work. Please review it before
opening a new github issue or asking a question in #grafana on freenode.

## General connection issues
When setting up Grafana for the first time you might experiance issues with Grafana being unable to query Graphite, OpenTSDB or InfluxDB.
You might not be able to get metric name completion or the graph might show an error like this:

![](/img/v1/graph_timestore_error.png)

For some type of errors the ``View details`` link will show you error details. But for many types of HTTP connection errors there is
very little information. The best way to troubleshoot these issues is use
[Chrome developer tools](https://developer.chrome.com/devtools/index). By pressing F12 you can bring up the chrome dev tools.

![](/img/v1/toubleshooting_chrome_dev_tools.png)

There are two important tabs in the chrome dev tools, ``Network`` and ``Console``. Console will show you javascript errors and HTTP
request errors. In the Network tab you will be able to identifiy the request that failed and review request and response parameters.
This information will be of great help in finding the cause of the error. If you are unable to solve the issue, even after reading
the remainder of this troubleshooting guide, you may open a [github support issue](https://github.com/grafana/grafana/issues).
Before you do that please search the existing closed or open issues. Also if you need to create a support issue,
screenshots and or text information about the chrome console error, request and response information from the network tab in chrome
developer tools are of great help.

### Inspecting Grafana metric requests
![](/img/v1/toubleshooting_chrome_dev_tools_network.png)

After open chrome developer tools for the first time the Network tab is empty you need to refresh the page to get requests to show.
For some type of errors (CORS related) there might not be a response at all.

## Graphite connection issues
If your Graphite web server is on another domain or IP than your Grafana web server you will need to [setup
CORS](../install/#graphite-server-config) (Cross Origin Resource Sharing).

You know if you are having CORS related issues if you get an error like this in chrome developer tools:

![](/img/v1/toubleshooting_graphite_cors_error.png)

If the request failed on method ``OPTIONS`` then you need to review your graphite web server configuration.

## Only blank white page
When you load Grafana and all you get is a blank white page then you probably have a javascript syntax error in ``config.js``.
In chrome developer tools console you will quickly identify the line of the syntax error.
