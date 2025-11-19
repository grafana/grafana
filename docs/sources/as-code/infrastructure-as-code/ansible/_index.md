---
keywords:
  - Infrastructure as Code
  - Quickstart
  - Grafana Cloud
  - Ansible
menuTitle: Ansible
title: Grafana Ansible collection
weight: 110
canonical: https://grafana.com/docs/grafana/latest/as-code/infrastructure-as-code/ansible/
aliases:
  - ../../infrastructure-as-code/ansible/ansible-grafana-agent-linux
  - ../../infrastructure-as-code/ansible/ansible-multiple-agents
labels:
  products:
    - cloud
---

# Grafana Ansible collection

The [Grafana Ansible collection](https://docs.ansible.com/ansible/latest/collections/grafana/grafana/) provides configuration management resources for Grafana. You can use it to manage resources such as dashboards, Cloud stacks, folders, and more.

For resources currently not available in the Grafana Ansible collection, you can manage those resources on Grafana Cloud programmatically by writing Ansible playbooks that use the [Ansible's builtin uri module](https://docs.ansible.com/ansible/latest/collections/ansible/builtin/uri_module.html) to call the [HTTP APIs](/docs/grafana/latest/developers/http_api/) to manage resources for the Grafana Cloud portal, as well as those within a stack.

Refer to [Create and manage a Grafana Cloud stack using Ansible](ansible-cloud-stack/) to learn how to create a Grafana Cloud stack and add a data source and dashboard using [Ansible](https://www.ansible.com/).

## Grafana Agent (deprecated)

{{< docs/shared lookup="agent-deprecation.md" source="alloy" version="next" >}}

The Ansible collection also houses [Grafana Agent role](https://github.com/grafana/grafana-ansible-collection/tree/main/roles/grafana_agent), which is now deprecated.
