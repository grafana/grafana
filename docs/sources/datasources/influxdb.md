----
page_title: InfluxDB query guide
page_description: InfluxDB query guide
page_keywords: grafana, influxdb, metrics, query, documentation
---


# InfluxDB

There are currently two separate datasources for InfluxDB in Grafana: InfluxDB 0.8.x and InfluxDB 0.9.x. The API and capabilities of InfluxDB 0.9.x are completely different from InfluxDB 0.8.x. InfluxDB 0.9.x data source support is provided on an experimental basis.

## Adding the data source to Grafana
Open the side menu by clicking the the Grafana icon in the top header. In the side menu under the `Dashboards` link you
should find a link named `Data Sources`. If this link is missing in the side menu it means that your current
user does not have the `Admin` role for the current organization.

![](/img/v2/add_datasource_influxdb.png)

Now click the `Add new` link in the top header.

Name | Description
------------ | -------------
Name | The data source name, important that this is the same as in Grafana v1.x if you plan to import old dashboards.
Default | Default data source means that it will be pre-selected for new panels.
Url | The http protocol, ip and port of you influxdb api (influxdb api port is by default 8086)
Access | Proxy = access via Grafana backend, Direct = access directory from browser.
Database | Name of your influxdb database
User | Name of your database user
Password | Database user's password

> *Note* When using Proxy access mode the InfluxDB database, user and password will be hidden from the browser/frontend. When
> using direct access mode all users will be able to see the database user & password.

## InfluxDB 0.9.x query editor

This editor & data source is not compatible with InfluxDB 0.8.x, please use the right data source for you InfluxDB version.
The InfluxDB 0.9.x editor is currently under development and is not yet fully usable.

## InfluxDB 0.8.x query editor

![](/img/v1/influxdb_editor.png)

When you add an InfluxDB query you can specify series name (can be regex), value column and a function. Group by time can be specified or if left blank will be automatically set depending on how long the current time span is. It will translate to a InfluxDB query that looks like this:

```sql
select [[func]]([[column]]) from [[series]] where [[timeFilter]] group by time([[interval]]) order asc
```

To write the complete query yourself click the cog wheel icon to the right and select ``Raw query mode``.

## InfluxDB 0.9 Filters & Templates queries

The InfluxDB 0.9 data source does not currently support filters or templates.

## InfluxDB 0.8 Filters & Templated queries

![](/img/animated_gifs/influxdb_templated_query.gif)


Use a distinct influxdb query in the filter query input box:

```sql
select distinct(host) from app.status
```



