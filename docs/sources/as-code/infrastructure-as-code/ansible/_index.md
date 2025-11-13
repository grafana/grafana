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
---

# Grafana Ansible collection

The [Grafana Ansible collection](https://docs.ansible.com/ansible/latest/collections/grafana/grafana/) provides configuration management resources for Grafana. You can use it to manage resources such as dashboards, Cloud stacks, folders, and more.

The collection also houses the [Grafana Agent role](https://github.com/grafana/grafana-ansible-collection/tree/main/roles/grafana_agent) which can be used to deploy and manage Grafana Agent across various Linux machines.

{{< docs/shared lookup="agent-deprecation.md" source="alloy" version="next" >}}

For resources currently not available in the Grafana Ansible collection, you can manage those resources on Grafana Cloud programmatically by writing Ansible playbooks that use the [Ansible's builtin uri module](https://docs.ansible.com/ansible/latest/collections/ansible/builtin/uri_module.html) to call the [HTTP APIs](/docs/grafana/latest/developers/http_api/) to manage resources for the Grafana Cloud portal, as well as those within a stack.

Use the following guides to get started using Ansible to manage your Grafana Cloud stack:

| Topic                                                                               | Description                                                                                                                  |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [Create and manage a Grafana Cloud stack using Ansible](ansible-cloud-stack/)       | Describes how to create a Grafana Cloud stack and add a data source and dashboard using [Ansible](https://www.ansible.com/). |
| [Install Grafana Agent on a Linux host using Ansible](ansible-grafana-agent-linux/) | Describes how to install the Grafana Agent on a Linux node using Ansible and use it to push logs to Grafana Cloud.           |
| [Monitor multiple Linux hosts with Grafana Agent Role](ansible-multiple-agents/)    | Describes how to use the Grafana Ansible collection to manage agents across multiple Linux hosts.                            |
