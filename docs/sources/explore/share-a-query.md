+++
title = "Share a Query"
keywords = ["explore", "loki", "logs"]
weight = 5
+++

# Share a query

Explore provides ways to share queries with others who have access via URLs.

## Share shortened link

> **Note:** Available in Grafana 7.3 and later versions.

The Share shortened link capability allows you to create smaller and simpler URLs of the format /goto/:uid instead of using longer URLs with query parameters. To create a shortened link to the executed query, click the **Share** option in the Explore toolbar. A shortened link that is never used will automatically get deleted after seven (7) days.

## Share links to derived fields in log queries

Derived fields can turn any part of a log message into an internal or external link.

To access the link, click the button next to the Detected field in the Log details view.

{{< figure src="/static/img/docs/explore/detected-fields-link-7-4.png" max-width="800px" caption="Detected fields link in Explore" >}}
