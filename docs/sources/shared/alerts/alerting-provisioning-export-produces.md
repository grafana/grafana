---
title: 'Alerting Produces '
---

#### Produces

- `application/json`
- `application/yaml`
- `application/terraform+hcl`
- `text/yaml`
- `text/hcl`

These outputs are for [file provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/file-provisioning) or [Terraform provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/provision-alerting-resources/file-provisioning), and they-including the JSON output—cannot be used to update resources via the HTTP API.
