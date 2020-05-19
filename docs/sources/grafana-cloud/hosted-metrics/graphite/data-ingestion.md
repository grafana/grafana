---
title: Data Ingestion
weight: 1
---

# Data Ingestion

We support:

* [carbon-relay-ng](https://github.com/graphite-ng/carbon-relay-ng), which is a graphite carbon relay, which supports aggregations and sending data to our endpoint over a secure, robust transport.
* custom tools that use our API. See our [golang, python and shell examples](https://github.com/grafana/hosted-metrics-sender-example)
* direct carbon input. This is discouraged though, as it is not reliable over the internet and not secure.

The recommended and most popular option is using carbon-relay-ng.
Customers typically deploy using either of these 2 options:

* run the relay as an extra component external to your existing graphite pipeline. Data can be directed to it from any existing carbon relay.
* replace an existing carbon-relay with carbon-relay-ng

If your Graphite stack does not currently contain any relay, then you can simply add carbon-relay-ng, have your clients (statsd, collectd, diamond, etc) send data to the relay, which in turn can send data to your existing graphite server *and* to our platform.

When creating a Hosted Metrics Graphite instance, we provide a carbon-relay-ng config file that you can plug in and be ready to use out of the box.
We also have Grafana Labs engineers ready to advise further on set up, if needed.

## Using carbon-relay-ng as a replacement for carbon-relay or carbon-cache

The most simple way to send your carbon traffic to GrafanaCloud is to use carbon-relay-ng as a replacement for your current carbon-relay or carbon-cache. Carbon-relay-ng has a carbon input which supports the plain text and the pickle protocols, just like carbon-relay and carbon-cache. Note that the consistent-hashing implementation in carbon-relay-ng is different from the one in carbon-relay, so if you're using consistent-hashing then switching from carbon-relay to carbon-relay-ng would re-distribute the metrics among the destinations.

An example configuration to do that can be downloaded from your Hosted Metrics instance's "Details" page. It contains a `grafanaNet` route pointing at your instance.

## Sending a copy of your carbon traffic to GrafanaCloud

### Duplicating traffic by adding Carbon-Relay-NG in front of carbon-relay or carbon-cache

It is possible to duplicate your data to send one copy to your existing Graphite infrastructure and the other to GrafanaCloud. To do this you can put an instance of carbon-relay-ng in front of your existing carbon-relay or carbon-cache and make it duplicate the traffic. Carbon-relay-ng allows you to specify routes of various types, to send a copy to GrafanaCloud you need to add a route of the type `grafanaNet`, to send a copy to your existing carbon-relay/carbon-cache you can add a carbon route.

For example if you currently have carbon-relay listening on port `2003` and all of your infrastructure is sending its carbon traffic there, you could change it to listen on port `2053` instead and then start a carbon-relay-ng on port `2003` with this config to send a copy of the traffic to `localhost:2053`:

```
[[route]]
key = 'carbon'
type = 'sendAllMatch'
destinations = [
    'localhost:2053 spool=true pickle=false'
]

[[route]]
key = 'grafanaNet'
type = 'grafanaNet'
addr = 'https://<Your endpoint address>'
apikey = '<Your Grafana.com API Key>'
schemasFile = '/etc/carbon-relay-ng/storage-schemas.conf'
```

### Duplicating traffic by adding a route to carbon-relay

#### With relay method `rules`

If you're already using carbon-relay with the relay method `rules` it is also possible to make it duplicate the traffic and send one copy to carbon-relay-ng. This can be done by using the flag `continue` in the rules file, for example if your current `relay-rules.conf` looks like this:

```
[default]
default = true
destinations = <original relay destination>:2003
```

Then you could use the `continue` keyword to duplicate the data and send a copy to carbon-relay-ng:

```
[carbonRelayNg]
pattern = .*
destinations = <carbon-relay-ng host>:2003
continue = True

[default]
default = true
destinations = <original relay destination>:2003
```

#### With relay method `consistent-hashing`

If you're using the relay method `consistent-hashing` and the `relay.REPLICATION_FACTOR` setting is equal to the number of hosts in `relay.DESTINATIONS` then you can make carbon-relay send another copy of your data to carbon-relay-ng by adding the carbon-relay-ng destination to `relay.DESTINATIONS` and increasing the `relay.REPLICATION_FACTOR` by `1`. However, if you use a replication factor which is less than the number of destinations, then one of the other described methods to duplicate the traffic would need to be used.

For example if your current `relay` section looks like this:

```
[relay]
RELAY_METHOD                                                                            = consistent-hashing
REPLICATION_FACTOR                                                                      = 2
DESTINATIONS                                                                            = <original relay destination 1>:2003,<original relay destination 2>:2003
```

Then after adding the carbon-relay-ng destination and increasing the replication factor it would look like this:

```
[relay]
RELAY_METHOD                                                                            = consistent-hashing
REPLICATION_FACTOR                                                                      = 3
DESTINATIONS                                                                            = <original relay destination 1>:2003,<original relay destination 2>:2003,<carbon relay ng>:2003
```

# High availability and scaling of carbon-relay-ng

## Scaling with carbon-relay-ng

When distributing traffic among multiple instances of carbon-relay-ng it is important to ensure that the same metrics always get sent to the same carbon-relay-ng instances to preserve the order of the data points. It's ok to have many carbon-relay-ng instances send data to GrafanaCloud concurrently.

```table
|-------------------| |-------------------| |-------------------| |-------------------| |-------------------| |-------------------|
| metric producer 1 | | metric producer 2 | | metric producer 3 | | metric producer 4 | | metric producer 5 | | metric producer 6 | 
|-------------------| |-------------------| |-------------------| |-------------------| |-------------------| |-------------------| 
                    \                     \           |                      |          /                     /
                     \                     \          |                      |         /                     /
                      \                     \         |                      |        /                     /
                       \                     \        |                      |       /                     /
                        \                     \       |                      |      /                     /
                         \                |-------------------|    |-------------------|                 /
                          \---------------| carbon-relay-ng-1 |    | carbon-relay-ng-2 |----------------/
                                          |-------------------|    |-------------------|
                                                             \      /
                                                              \    /
                                                         |--------------|
                                                         | GrafanaCloud |
                                                         |--------------|
```

## Failure tolerance with carbon-relay-ng

As mentioned in the previous chapter, it is important that metrics get distributed among carbon-relay-ng instances in a consistent way to preserve the order of the datapoints. However, it is ok to run carbon-relay-ng in a hot / cold-standby setup to ensure that if the primary goes down the secondary would take over its load.

This setup gives you failure tolerance and scalability:

```table
|-------------------| |-------------------| |-------------------| |-------------------| |-------------------| |-------------------|
| metric producer 1 | | metric producer 2 | | metric producer 3 | | metric producer 4 | | metric producer 5 | | metric producer 6 | 
|-------------------| |-------------------| |-------------------| |-------------------| |-------------------| |-------------------| 
          \                     /                   /                        \                    /                    /
           \                   /                   /                          \                  /                    /
            \                 / /-----------------/                            \                / /------------------/
             \               / /                                                \              / /
              \ <hot>       / /       <cold-standby>                             \    <hot>   / /         <cold-standby>
         |-------------------|    |-------------------|                       |-------------------|    |-------------------|
         | carbon-relay-ng-1 |    | carbon-relay-ng-2 |                       | carbon-relay-ng-3 |    | carbon-relay-ng-4 |
         |-------------------|    |-------------------|                       |-------------------|    |-------------------|
                            \                        \                         /                        /
                             \                        \                       /                        /
                              \                        \                     /                        /
                               \                        |-------------------|                        /
                                \-----------------------|   GrafanaCloud    |-----------------------/
                                                        |-------------------|
```