---
page_title: What's New in Grafana v2.1
page_description: What's new in Grafana v2.1
page_keywords: grafana, new, changes, features, documentation
---

#What's new in Grafana v2.1

##More Dynamic Dashboards
The Templating system is one of the most powerful and well-used features of Grafana. The 2.1 release brings numerous improvements that make Dashboards more dynamic than ever before.


### Multi-Value Template Select
Multi-Value Select allows for the selection of multiple template variables.
These variables can be used in any Panel to make them more dynamic, and automatically show only the desired data.
Multi-Value Select is also a basis for enabling Repeating Rows and Repeating Panels.

![Multi-Value Select](/img/v2/multi-select.gif "Multi-Value Select")
<br/><br/>

### Repeating Rows and Panels
It’s now possible to create a Dashboard that automatically adds (and removes) both Rows and Panels based on which Template variables you have selected.
Any Row or Any Panel can be configured to repeat (duplicate itself) based on the Multi-Value Template variables selected.

![Repeating Rows and Panels](/img/v2/panel-row-repeat.gif "Repeating Rows and Panels")
<br/><br/>

### Dashboard Links
To support better navigation between Dashboarads, it is possible to create custom and dynamic links from individual Panels to appropriate Dashboards (1888)

![Dashboard Links](/img/v2/panel-link.png "Dashboard Links")
<br/><br/>

### Better local Dashboard support
Grafana can now index Dashboards saved locally as JSON from a given directory.

> ***Note:*** Saving local dashboards back the folder is not supported; this feature is meant for statically generated JSON dashboards.

- - -

## Improved authentication engine

### LDAP support

### Basic Auth support
You can now authenticate against the Grafana API utilizing a simple username and password with basic HTTP authentication.

> ***Note:*** This can be useful for provisioning and config management systems that need to utilize the API without having to create an API key.


### User authentication utilizing headers
You can now authenticate utilizing a header (eg. X-Authenticated-User, or X-WEBAUTH-USER)

> ***Note:*** this can be useful in situations with reverse proxies.


### New “Read-only Editor” User Role
There is a new User role available in this version of Grafana: “Read-only Editor”. This role disables the query editor for the user and puts him in a read-only sandbox of sorts.

> ***Note:*** Even with this role assigned, Read-only Editors still have access to ALL metrics from that Datasource. This is not a way to achieve a true multitenant segregated environment with Grafana.

- - -

##Improved data source support

### Improved Data Sources
We continue to make progress on fully supporting InfluxDB 0.9, but it has proven to be a bit of a moving target. This Grafana release brings a much improved query editor for InfluxDB 0.9

![InfluxDB Support](/img/v2/influx-query.gif "InfluxDB Support")
<br/><br/>


### OpenTSDB Data Source improvements
Grafana now supports template variable values lookup queries, as well as limiting tags by metric

> ***Note:*** OpenTSDB config option tsd.core.meta.enable_realtime_ts must enabled for OpenTSDB lookup api)


### New Data Source: KairosDB
Experimental support for the KairosDB is now shipping in Grafana. Thank you to < > for their hard work in getting it to this point.

- - -

## Panel Improvements

### Graph Panel
Define series color using regex rule    
![Define series color using regex rule  ](/img/v2/regex_color.gif "Define series color using regex rule  ")

New series style override, negative-y transform and stack groups
![Negative-y Transform](/img/v2/negative-y.png "Negative-y Transform")

![Negative-y Transform](/img/v2/negative-y-form.png "Negative-y Transform")

### Singlestat Panel
Now support string values - read more about [Singlestat Panels](../reference/singlestat.md)
