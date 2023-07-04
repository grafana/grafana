---
aliases:
  - ../high-availability/enable-alerting-ha/
  - ../unified-alerting/high-availability/
description: Enable alerting high availability
keywords:
  - grafana
  - alerting
  - tutorials
  - ha
  - high availability
title: Enable alerting high availability
weight: 400
---

# Enable alerting high availability

You can enable alerting high availability support by updating the Grafana configuration file. If you run Grafana in a Kubernetes cluster, additional steps are required. Both options are described below.
Please note that the deduplication is done for the notification, but the alert will still be evaluated on every Grafana instance. This means that events in alerting state history will be duplicated by the number of Grafana instances running.

## Enable alerting high availability in Grafana

### Before you begin

Since gossiping of notifications and silences uses both TCP and UDP port `9094`, ensure that each Grafana instance is able to accept incoming connections on these ports.

**To enable high availability support:**

1. In your custom configuration file ($WORKING_DIR/conf/custom.ini), go to the `[unified_alerting]` section.
2. Set `[ha_peers]` to the number of hosts for each Grafana instance in the cluster (using a format of host:port), for example, `ha_peers=10.0.0.5:9094,10.0.0.6:9094,10.0.0.7:9094`.
   You must have at least one (1) Grafana instance added to the [`[ha_peer]` section.
3. Set `[ha_listen_address]` to the instance IP address using a format of `host:port` (or the [Pod's](https://kubernetes.io/docs/concepts/workloads/pods/) IP in the case of using Kubernetes).
   By default, it is set to listen to all interfaces (`0.0.0.0`).

## Enable alerting high availability using Kubernetes

If you are using Kubernetes, you can expose the pod IP [through an environment variable](https://kubernetes.io/docs/tasks/inject-data-application/environment-variable-expose-pod-information/) via the container definition.

```bash
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
```
