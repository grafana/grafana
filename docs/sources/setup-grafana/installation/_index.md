---
aliases:
  - ../install/
  - ../installation/
  - ../installation/installation/
  - ../installation/requirements/
  - /docs/grafana/v2.1/installation/install/
  - ./installation/rpm/
description: Installation guide for Grafana
labels:
  products:
    - enterprise
    - oss
title: Install Grafana
weight: 100
---

# Install Grafana

This page lists the minimum hardware and software requirements to install Grafana.

To run Grafana, you must have a supported operating system, hardware that meets or exceeds minimum requirements, a supported database, and a supported browser.

The following video guides you through the steps and common commands for installing Grafana on various operating systems as described in this document.

{{< youtube id="f-x_p2lvz8s" >}}

Grafana relies on other open source software to operate. For a list of open source software that Grafana uses, refer to [package.json](https://github.com/grafana/grafana/blob/main/package.json).

## Supported operating systems

Grafana supports the following operating systems:

- [Debian or Ubuntu](debian/)
- [RHEL or Fedora](redhat-rhel-fedora/)
- [SUSE or openSUSE](suse-opensuse/)
- [macOS](mac/)
- [Windows](windows/)

{{< admonition type="note" >}}
Installation of Grafana on other operating systems is possible, but is not recommended or supported.
{{< /admonition >}}

## Hardware recommendations

Grafana requires the following minimum system resources:

- Minimum recommended memory: 512 MB
- Minimum recommended CPU: 1 core

Some features might require more memory or CPUs. For more information, refer to the following sizing guidance.

### Sizing your deployment

This sizing guidance covers the Grafana server process only, meaning the UI, data source proxy, alert engine, and image renderer. It does not account for the resources required by your data sources. Metric stores such as Prometheus or Grafana Mimir, log stores such as Grafana Loki, and trace backends such as Grafana Tempo each have their own hardware and capacity requirements. For guidance, refer to [Planning Grafana Mimir capacity](https://grafana.com/docs/mimir/latest/manage/run-production-environment/planning-capacity), [Size the Loki cluster](https://grafana.com/docs/loki/latest/setup/size), and [Plan your Tempo deployment](https://grafana.com/docs/tempo/latest/set-up-for-tracing/setup-tempo/plan/).

Four factors most directly drive resource needs for Grafana:

- **Concurrent users:** active, concurrent browser sessions issuing queries or causing panels to refresh. This is the primary driver of CPU and memory load. Users who have Grafana open but are not actively viewing dashboards contribute little load, unless those dashboards have auto-refresh enabled.
- **Alert rules:** background evaluation load on the alert scheduler. High rule counts with short evaluation intervals can saturate CPU independently of user activity. In Grafana OSS, the alert engine runs in the same process as the UI and data source proxy, so alert CPU saturation directly competes with dashboard query performance. This is why isolating alert evaluation to dedicated instances matters at Large scale. Refer to [Performance considerations and limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/performance-limitations/) for details.
- **Data sources:** while the number of proxied data source connections matters, type matters more. Plugins that use the Grafana backend data source proxy — most SQL sources such as MySQL, PostgreSQL, and Microsoft SQL Server — hold an open connection per query on the server. Pull-based metric sources such as Prometheus or Graphite are queried more efficiently and place less load on the Grafana process. Some plugins, such as certain public API or Infinity sources, execute queries directly in the browser and may place no server-side load — depending on plugin configuration and authentication requirements. A deployment with five heavily-queried proxied SQL data sources can exceed the resource needs of one with twenty Prometheus sources.
- **Dashboards and panels:** panel count and refresh interval together determine query throughput. A dashboard with 30 panels refreshing every 10 seconds generates roughly six times the query load of the same dashboard refreshing every minute. Dashboards with many panels and short refresh intervals should be treated as a tier higher than their raw dashboard count suggests. Note that Grafana Enterprise includes query caching, which can significantly reduce this multiplier when many users view the same dashboard simultaneously and may shift a deployment down a tier.

Image rendering and large numbers of short-interval alert rules are the two most common reasons a deployment outgrows its initial sizing. Multi-organization setups and SSO or LDAP directory sync add overhead that can push a deployment into the next tier.

### Deployment tiers

Use the table below to identify which tier describes your workload, then refer to the corresponding hardware baseline.

| Tier   | Concurrent users | Alert rules | Data sources | Dashboards  |
| ------ | ---------------- | ----------- | ------------ | ----------- |
| Small  | < 25             | < 100       | < 5          | < 200       |
| Medium | 25 – 200         | 100 – 1,000 | 5 – 25       | 200 – 2,000 |
| Large  | 200+             | 1,000+      | 25+          | 2,000+      |

The dashboard count threshold assumes roughly 10-20 panels per dashboard with refresh intervals of 30 seconds or longer. Dashboards with more panels or shorter refresh intervals produce proportionally more query load and should be weighted toward the higher tier. Similarly, the data source count assumes a mix of source types. Deployments that rely heavily on proxied SQL sources should plan for the next tier up.

These thresholds are starting points. Validate sizing with a load test that reflects your actual dashboard complexity, panel count, and refresh rates before committing to production hardware. Size for your current workload and include headroom for traffic spikes and growth.

#### Small

Small deployments suit small teams, internal tooling, and low-traffic environments.

| Resource  | Minimum                        |
| --------- | ------------------------------ |
| CPU       | 2 cores                        |
| Memory    | 2 – 4 GB                       |
| Disk      | 10 – 20 GB SSD (database host) |
| Instances | 1                              |

**Database:** SQLite works for local development and small evaluation instances, but isn't recommended for production environments. For production use, consider an external MySQL or PostgreSQL instance for higher reliability and growth capacity. For more information, refer to [Supported databases](#supported-databases).

**Image rendering:** optional; can run on the same host for light use. Refer to [Set up image rendering](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/).

#### Medium

Medium deployments suit shared team environments and departmental observability platforms.

| Resource  | Recommendation                 |
| --------- | ------------------------------ |
| CPU       | 4 – 8 cores                    |
| Memory    | 8 – 16 GB                      |
| Disk      | 20 – 50 GB SSD (database host) |
| Instances | 2 (load-balanced)              |

**Database:** SQLite isn't recommended for production environments and isn't suitable at this tier. Use an external MySQL or PostgreSQL database. Refer to [Supported databases](#supported-databases) for guidance on choosing an external database.

**Image rendering:** run the image renderer as a separate process or container. Each renderer worker uses approximately 1 GB of memory; size your renderer host accordingly. Refer to [Set up image rendering](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/).

**High availability:** if you run two or more Grafana instances, configure a Redis session store or enable sticky sessions at the load balancer to prevent users from being signed out between requests. Refer to [Set up Grafana for high availability](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-for-high-availability/).

#### Large

Large deployments suit organization-wide platforms and high-traffic production environments.

| Resource  | Recommendation                                                    |
| --------- | ----------------------------------------------------------------- |
| CPU       | 8 – 16+ cores per instance                                        |
| Memory    | 16 – 32+ GB per instance                                          |
| Disk      | 50+ GB SSD, high I/O operations per second (IOPS) (database host) |
| Instances | 3+ (load-balanced)                                                |
| Network   | 10 Gbps or faster                                                 |

**Database:** SQLite isn't recommended for production environments and isn't suitable at this tier. A highly available MySQL or PostgreSQL cluster is strongly advised. Refer to [Supported databases](#supported-databases).

**Image rendering:** run a dedicated renderer fleet with multiple workers, isolated from Grafana instances. Each renderer worker uses approximately 1 GB of memory. Refer to [Set up image rendering](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/image-rendering/).

**Alert evaluation:** with more than 1,000 alert rules or short evaluation intervals of under one minute, alert evaluation can saturate CPU and degrade dashboard query performance on the same instance. Isolate alert evaluation to one or more dedicated Grafana instances in [remote evaluation mode](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/) to prevent this. Refer to [Performance considerations and limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/performance-limitations/).

**High availability:** sticky sessions or a shared Redis session store are required. Refer to [Set up Grafana for high availability](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-for-high-availability/).

**Data source latency:** minimize network hops between Grafana instances and data sources. Low-latency links to your database and data sources are important at this scale.

**Deployment model:** managing three or more Grafana instances alongside a Redis cluster, renderer fleet, and highly available database becomes operationally complex on bare metal. Kubernetes reduces this operational burden significantly at this tier. Refer to [Deploy Grafana on Kubernetes](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/installation/kubernetes/) and the [Grafana Helm chart](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/installation/helm/) for guidance.

## Supported databases

Grafana requires a database to store its configuration data, such as users, data sources, and dashboards. The exact requirements depend on the size of the Grafana installation and the features you use.

Grafana supports the following databases:

- [SQLite 3](https://www.sqlite.org/index.html)
- [MySQL 8.0+](https://www.mysql.com/support/supportedplatforms/database.html)
- [PostgreSQL 12+](https://www.postgresql.org/support/versioning/)

By default Grafana uses an embedded SQLite database, which is stored in the Grafana installation location. If you need to migrate to a different database later, note that database schema and data migrations are customer-managed operations and fall outside the scope of Grafana Support.

{{< admonition type="caution" >}}
SQLite isn't recommended for production environments. It works well for local development and small evaluation instances, but it doesn't scale for production workloads. If you want [high availability](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-for-high-availability/), you must use either a MySQL or PostgreSQL database. For information about how to define the database configuration parameters inside the `grafana.ini` file, refer to [[database]](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/#database).
{{< /admonition >}}

Grafana supports the versions of these databases that are officially supported by the project at the time a version of Grafana is released. When a Grafana version becomes unsupported, Grafana Labs might also drop support for that database version. See the links above for the support policies for each project.

{{< admonition type="note" >}}
PostgreSQL versions 10.9, 11.4, and 12-beta2 are affected by a bug (tracked by the PostgreSQL project as [bug #15865](https://www.postgresql.org/message-id/flat/15865-17940eacc8f8b081%40postgresql.org)) which prevents those versions from being used with Grafana. The bug has been fixed in more recent versions of PostgreSQL.
{{< /admonition >}}

{{< admonition type="note" >}}
Grafana binaries and images might not work with unsupported databases, even if they claim to be drop-in or replicate the API to their best.
Binaries and images built with [BoringCrypto](https://pkg.go.dev/crypto/internal/boring) may have different problems than other distributions of Grafana.
{{< /admonition >}}

> Grafana can report errors when relying on read-only MySQL servers, such as in high-availability failover scenarios or serverless AWS Aurora MySQL. This is a known issue; for more information, see [issue #13399](https://github.com/grafana/grafana/issues/13399).

## Supported web browsers

Grafana supports the current version of the following browsers. Older versions of these browsers might not be supported, so you should always upgrade to the latest browser version when using Grafana.

{{< admonition type="note" >}}
Enable JavaScript in your browser. Running Grafana without JavaScript enabled in the browser is not supported.
{{< /admonition >}}

- Chrome/Chromium
- Firefox
- Safari
- Microsoft Edge
