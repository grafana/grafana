+++
title = "Grafana Enterprise"
description = "Grafana Enterprise overview"
keywords = ["grafana", "documentation", "datasource", "permissions", "ldap", "licensing", "enterprise"]
type = "docs"
[menu.docs]
name = "Grafana Enterprise"
identifier = "enterprise"
weight = 30
+++

# Grafana Enterprise

Grafana Enterprise is a commercial edition of Grafana that includes additional features not found in the open source
version.

Building on everything you already know and love about Grafana, Grafana Enterprise adds premium data sources,
advanced authentication options, more permission controls, 24x7x365 support, and training from the core Grafana team.

Grafana Enterprise includes all of the features found in the open source edition and more.

___

### Enhanced LDAP Integration

With Grafana Enterprise you can set up synchronization between LDAP Groups and Teams. [Learn More]({{< relref "auth/enhanced_ldap.md" >}}).

### Datasource Permissions

Datasource permissions allow you to restrict query access to only specific Teams and Users. [Learn More]({{< relref "permissions/datasource_permissions.md" >}}).

### Premium Plugins

With a Grafana Enterprise licence you will get access to premium plugins, including:

* [Splunk](https://grafana.com/plugins/grafana-splunk-datasource)
* [AppDynamics](https://grafana.com/plugins/dlopes7-appdynamics-datasource)
* [DataDog](https://grafana.com/plugins/grafana-datadog-datasource)
* [Dynatrace](https://grafana.com/plugins/grafana-dynatrace-datasource)
* [New Relic](https://grafana.com/plugins/grafana-newrelic-datasource)

## Try Grafana Enterprise

You can learn more about Grafana Enterprise [here](https://grafana.com/enterprise). To purchase or obtain a trial license contact
the Grafana Labs [Sales Team](https://grafana.com/contact?about=support&topic=Grafana%20Enterprise).

## License file management

To download your Grafana Enterprise license log in to your [Grafana.com](https://grafana.com) account and go to your **Org
Profile**. In the side menu there is a section for Grafana Enterprise licenses. At the bottom of the license
details page there is **Download Token** link that will download the *license.jwt* file containing your license.

Place the *license.jwt* file in Grafana's data folder. This is usually located at `/var/lib/grafana/data` on linux systems.

You can also configure a custom location for the license file via the ini setting:

```bash
[enterprise]
license_path = /company/secrets/license.jwt
```

This setting can also be set via ENV variable which is useful if you're running Grafana via docker and have a custom
volume where you have placed the license file. In this case set the ENV variable `GF_ENTERPRISE_LICENSE_PATH` to point
to the location of your license file.



