collectd-write-graphite
=======================

Basic collectd-based server monitoring. Sends stats to Graphite.

Collectd metrics:

- CPU used/free/idle/etc
- Free disk (via mounting hosts '/' into container, eg: -v /:/hostfs:ro)
- Disk performance
- Load average
- Memory used/free/etc
- Uptime
- Network interface
- Swap

Environment variables
---------------------

- `HOST_NAME`
  - Will be sent to Graphite
  - Required
- `GRAPHITE_HOST`
  - Graphite IP or hostname
  - Required
- `GRAPHITE_PORT`
  - Graphite port
  - Optional, defaults to 2003
- `GRAPHITE_PREFIX`
  - Graphite prefix
  - Optional, defaults to collectd.
- `REPORT_BY_CPU`
  - Report per-CPU metrics if true, global sum of CPU metrics if false (details: [collectd.conf man page](https://collectd.org/documentation/manpages/collectd.conf.5.shtml#plugin_cpu))
  - Optional, defaults to false.
- `COLLECT_INTERVAL`
  - Collection interval and thus resolution of metrics
  - Optional, defaults to 10
