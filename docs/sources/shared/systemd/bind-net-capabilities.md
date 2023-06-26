---
title: Serving Grafana on a port < 1024
---

If you are using `systemd` and want to start Grafana on a port that is lower than 1024, you must add a `systemd` unit override.

1. Run the following command to create an override file in your configured editor.

   ```bash
   # Alternatively, create a file in /etc/systemd/system/grafana-server.service.d/override.conf
   systemctl edit grafana-server.service
   ```

1. Add the following additional settings to grant the `CAP_NET_BIND_SERVICE` capability.

   To learn more about capabilities, refer to [capabilities(7) — Linux manual page](https://man7.org/linux/man-pages/man7/capabilities.7.html).

   ```
   [Service]
   # Give the CAP_NET_BIND_SERVICE capability
   CapabilityBoundingSet=CAP_NET_BIND_SERVICE
   AmbientCapabilities=CAP_NET_BIND_SERVICE

   # A private user cannot have process capabilities on the host's user
   # namespace and thus CAP_NET_BIND_SERVICE has no effect.
   PrivateUsers=false
   ```
