+++
title = " Enable alerting high availability"
description = "Enable alerting high availability"
keywords = ["grafana", "alerting", "tutorials", "ha", "high availability"]
weight = 450
+++

# Enable alerting high availability

You can enable jihj availability by mofifying the configuration file. In a Kubernetes environment, you can enable high availability by updating the container definition.

## Updating the configuration file

To enable high availability support you need to add at least 1 Grafana instance to the [`[ha_peer]` configuration option]({{<relref"../../../administration/configuration.md#unified_alerting">}}) within the `[unified_alerting]` section:

1. In your custom configuration file ($WORKING_DIR/conf/custom.ini), go to the `[unified_alerting]` section.
2. Set `[ha_peers]` to the number of hosts for each grafana instance in the cluster (using a format of host:port) e.g. `ha_peers=10.0.0.5:9094,10.0.0.6:9094,10.0.0.7:9094`
3. Gossiping of notifications and silences uses both TCP and UDP port 9094. Each Grafana instance will need to be able to accept incoming connections on these ports.
4. Set `[ha_listen_address]` to the instance IP address using a format of host:port (or the [Pod's](https://kubernetes.io/docs/concepts/workloads/pods/) IP in the case of using Kubernetes) by default it is set to listen to all interfaces (`0.0.0.0`).

## Kubernetes - updating the container defnition

If you are using Kubernetes, you can expose the pod IP [through an environment variable](https://kubernetes.io/docs/tasks/inject-data-application/environment-variable-expose-pod-information/) via the container definition such as:

```bash
env:
- name: POD_IP
  valueFrom:
    fieldRef:
      fieldPath: status.podIP
```
