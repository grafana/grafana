---
page_title: Provisioning
page_description: Grafana provisioning
page_keywords: grafana, provisioning, documentation
---

# Provisioning

Here are links for how to install Grafana (and some include Graphite or
InfluxDB as well) via a provisioning system. These are not maintained by
any core Grafana team member and might be out of date.

Some of the linked cookbooks/manifests/etc. will install and configure Grafana 2.x, while some will only install the older Grafana 1.x versions. They've been broken apart below for your convenience.

## Compatible with Grafana 2.x

### Puppet

* [forge.puppetlabs.com/bfraser/grafana](https://forge.puppetlabs.com/bfraser/grafana) **Note:** The current version works with Grafana 2.x. To install older versions of Grafana use the 1.x series of releases.

### Ansible

* [github.com/picotrading/ansible-grafana](https://github.com/picotrading/ansible-grafana)

### Docker
* [github.com/grafana/grafana-docker](https://github.com/grafana/grafana-docker)

### Chef

* [github.com/JonathanTron/chef-grafana](https://github.com/JonathanTron/chef-grafana) **Note:** The current version works with Grafana 2.x. To install older versions of Grafana use the 1.x series of releases.
* [github.com/Nordstrom/grafana2-cookbook](https://github.com/Nordstrom/grafana2-cookbook)

## Compatible with Grafana 1.x only

### Ansible

* [github.com/bobrik/ansible-grafana](https://github.com/bobrik/ansible-grafana)
* [github.com/bitmazk/ansible-digitalocean-influxdb-grafana](https://github.com/bitmazk/ansible-digitalocean-influxdb-grafana)

### Docker

* [github.com/kamon-io/docker-grafana-graphite](https://github.com/kamon-io/docker-grafana-graphite)
* [github.com/kamon-io/docker-grafana-influxdb](https://github.com/kamon-io/docker-grafana-influxdb)
* [github.com/tutumcloud/tutum-docker-grafana](https://github.com/tutumcloud/tutum-docker-grafana)
* [github.com/mingfang/docker-grafana](https://github.com/mingfang/docker-grafana)

### Chef

* [github.com/dzautner/grafana-cookbook](https://github.com/dzautner/grafana-cookbook)
