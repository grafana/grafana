---
aliases:
  - ../high-availability/enable-alerting-ha/
  - ../unified-alerting/high-availability/
  - /docs/grafana/latest/alerting/set-up/configure-high-availability
description: Enable alerting high availability
keywords:
  - grafana
  - alerting
  - tutorials
  - ha
  - high availability
title: Enable alerting high availability
weight: 300
---

# Enable alerting high availability

You can enable alerting high availability support by updating the Grafana configuration file. On Kubernetes, you can enable alerting high availability by updating the Kubernetes container definition.

## Update Grafana configuration file

### Before you begin

Since gossiping of notifications and silences uses both TCP and UDP port `9094`, ensure that each Grafana instance is able to accept incoming connections on these ports.

**To enable high availability support:**

1. In your custom configuration file ($WORKING_DIR/conf/custom.ini), go to the `[unified_alerting]` section.
2. Set `[ha_peers]` to the number of hosts for each Grafana instance in the cluster (using a format of host:port), for example, `ha_peers=10.0.0.5:9094,10.0.0.6:9094,10.0.0.7:9094`.
   You must have at least one (1) Grafana instance added to the [`[ha_peer]` section.
3. Set `[ha_listen_address]` to the instance IP address using a format of `host:port` (or the [Pod's](https://kubernetes.io/docs/concepts/workloads/pods/) IP in the case of using Kubernetes).
   By default, it is set to listen to all interfaces (`0.0.0.0`).

## Update Kubernetes container definition

If you are using Kubernetes, you can expose the pod IP [through an environment variable](https://kubernetes.io/docs/tasks/inject-data-application/environment-variable-expose-pod-information/) via the container definition such as:

```bash
env:
- name: POD_IP
  valueFrom:
    fieldRef:
      fieldPath: status.podIP
```
