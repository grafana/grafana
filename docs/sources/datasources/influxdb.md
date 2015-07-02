----
page_title: InfluxDB query guide
page_description: InfluxDB query guide
page_keywords: grafana, influxdb, metrics, query, documentation
---

# InfluxDB

There are currently two separate datasources for InfluxDB in Grafana: InfluxDB 0.8.x and InfluxDB 0.9.x.
The API and capabilities of InfluxDB 0.9.x are completely different from InfluxDB 0.8.x which is why Grafana handles
them as different data sources.

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

## InfluxDB 0.9.x

![](/img/influxdb/InfluxDB_09_editor.png)

You find the InfluxDB editor in the metrics tab in Graph or Singlestat panel's edit mode. You enter edit mode by clicking the
panel title, then edit. The editor allows you to select metrics and tags.

### Editor tag filters
To add a tag filter click the plus icon to the right of the `WHERE` condition. You can remove tag filters by clicking on
the tag key and select `--remove tag filter--`.

### Editor group by
To group by a tag click the plus icon after the `GROUP BY ($interval)` text. Pick a tag from the dropdown that appears.
You can remove the group by by clicking on the tag and then select `--remove group by--` from the dropdown.

### Editor RAW Query
You can switch to raw query mode by pressing the pen icon.

> If you use Raw Query be sure your query at minimum have `WHERE $timeFilter` clause and ends with `order by asc`.
> Also please always have a group by time and an aggregation function, otherwise InfluxDB can easily return hundreds of thousands
> of data points that will hang the browser.

### Alias patterns

- $m = replaced with measurement name
- $measurement = replaced with measurement name
- $tag_hostname = replaced with the value of the hostname tag
- You can also use [[tag_hostname]] pattern replacement syntax

### Templating
You can create a template variable in Grafana and have that variable filled with values from any InfluxDB metric exploration query.
You can then use this variable in your InfluxDB metric queries.

For example you can have a variable that contains all values for tag `hostname` if you specify a query like this
in the templating edit view.
```sql
SHOW TAG VALUES WITH KEY = "hostname"
```

You can also create nested variables. For example if you had another variable, for example `region`. Then you could have
the hosts variable only show hosts from the current selected region with a query like this:

```sql
SHOW TAG VALUES WITH KEY = "hostname"  WHERE region =~ /$region/
```

> Always you `regex values` or `regex wildcard` for All format or multi select format.

![](/img/influxdb/templating_simple_ex1.png)

### Annotations

### InfluxDB 0.8.x

![](/img/v1/influxdb_editor.png)

## InfluxDB 0.8 Filters & Templated queries

![](/img/animated_gifs/influxdb_templated_query.gif)

Use a distinct influxdb query in the filter query input box:

```sql
select distinct(host) from app.status
```



