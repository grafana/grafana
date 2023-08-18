---
aliases:
  - ../high-availability/enable-alerting-ha/
  - ../unified-alerting/high-availability/
canonical: https://grafana.com/docs/grafana/latest/alerting/set-up/configure-high-availability/
description: Enable alerting high availability
keywords:
  - grafana
  - alerting
  - tutorials
  - ha
  - high availability
labels:
  products:
    - enterprise
    - oss
title: Enable alerting high availability
weight: 400
---

# Enable alerting high availability

You can enable alerting high availability support by updating the Grafana configuration file. If you run Grafana in a Kubernetes cluster, additional steps are required. Both options are described below.
Please note that the deduplication is done for the notification, but the alert will still be evaluated on every Grafana instance. This means that events in alerting state history will be duplicated by the number of Grafana instances running.

## Enable alerting high availability in Grafana using Memberlist

### Before you begin

Since gossiping of notifications and silences uses both TCP and UDP port `9094`, ensure that each Grafana instance is able to accept incoming connections on these ports.

**To enable high availability support:**

1. In your custom configuration file ($WORKING_DIR/conf/custom.ini), go to the `[unified_alerting]` section.
2. Set `[ha_peers]` to the number of hosts for each Grafana instance in the cluster (using a format of host:port), for example, `ha_peers=10.0.0.5:9094,10.0.0.6:9094,10.0.0.7:9094`.
   You must have at least one (1) Grafana instance added to the [`[ha_peer]` section.
3. Set `[ha_listen_address]` to the instance IP address using a format of `host:port` (or the [Pod's](https://kubernetes.io/docs/concepts/workloads/pods/) IP in the case of using Kubernetes).
   By default, it is set to listen to all interfaces (`0.0.0.0`).
4. Set `[ha_peer_timeout]` in the `[unified_alerting]` section of the custom.ini to specify the time to wait for an instance to send a notification via the Alertmanager. The default value is 15s, but it may increase if Grafana servers are located in different geographic regions or if the network latency between them is high.

## Enable alerting high availability in Grafana using Redis

As an alternative to Memberlist, you can use Redis for high availability. This is useful if you want to have a central
database for HA and cannot support the meshing of all Grafana servers.

1. Make sure you have a redis server that supports pub/sub. If you use a proxy in front of your redis cluster, make sure the proxy supports pub/sub.
2. In your custom configuration file ($WORKING_DIR/conf/custom.ini), go to the [unified_alerting] section.
3. Set `ha_redis_address` to the redis server address Grafana should connect to.
4. [Optional] Set the username and password if authentication is enabled on the redis server using `ha_redis_username` and `ha_redis_password`.
5. [Optional] Set `ha_redis_prefix` to something unique if you plan to share the redis server with multiple Grafana instances.

The following metrics can be used for meta monitoring, exposed by Grafana's `/metrics` endpoint:

| Metric                                               | Description                                                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| alertmanager_cluster_messages_received_total         | Total number of cluster messages received.                                                                     |
| alertmanager_cluster_messages_received_size_total    | Total size of cluster messages received.                                                                       |
| alertmanager_cluster_messages_sent_total             | Total number of cluster messages sent.                                                                         |
| alertmanager_cluster_messages_sent_size_total        | Total number of cluster messages received.                                                                     |
| alertmanager_cluster_messages_publish_failures_total | Total number of messages that failed to be published.                                                          |
| alertmanager_cluster_members                         | Number indicating current number of members in cluster.                                                        |
| alertmanager_peer_position                           | Position the Alertmanager instance believes it's in. The position determines a peer's behavior in the cluster. |
| alertmanager_cluster_pings_seconds                   | Histogram of latencies for ping messages.                                                                      |
| alertmanager_cluster_pings_failures_total            | Total number of failed pings.                                                                                  |

## Enable alerting high availability using Kubernetes

If you are using Kubernetes, you can expose the pod IP [through an environment variable](https://kubernetes.io/docs/tasks/inject-data-application/environment-variable-expose-pod-information/) via the container definition.

```yaml
env:
  - name: POD_IP
    valueFrom:
      fieldRef:
        fieldPath: status.podIP
```

1. Add the port 9094 to the Grafana deployment:

```yaml
ports:
  - containerPort: 3000
    name: http-grafana
    protocol: TCP
  - containerPort: 9094
    name: grafana-alert
    protocol: TCP
```

2. Add the environment variables to the Grafana deployment:

```yaml
env:
  - name: POD_IP
    valueFrom:
      fieldRef:
        fieldPath: status.podIP
```

3. Create a headless service that returns the pod IP instead of the service IP, which is what the `ha_peers` need:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: grafana-alerting
  namespace: grafana
  labels:
    app.kubernetes.io/name: grafana-alerting
    app.kubernetes.io/part-of: grafana
spec:
  type: ClusterIP
  clusterIP: 'None'
  ports:
    - port: 9094
  selector:
    app: grafana
```

4. Make sure your grafana deployment has the label matching the selector, e.g. `app:grafana`:

5. Add in the grafana.ini:

```bash
[unified_alerting]
enabled = true
ha_listen_address = "${POD_IP}:9094"
ha_peers = "grafana-alerting.grafana:9094"
ha_advertise_address = "${POD_IP}:9094"
ha_peer_timeout = 15s
```
