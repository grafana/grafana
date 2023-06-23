---
aliases:
  - /docs/grafana-cloud/alerts/alerts-rules/
  - /docs/grafana-cloud/how-do-i/alerts/alerts-rules/
  - /docs/grafana-cloud/legacy-alerting/alerts-rules/
  - /docs/grafana-cloud/metrics/prometheus/alerts_rules/
  - /docs/hosted-metrics/prometheus/alerts_rules/
  - /docs/grafana-cloud/alerts/grafana-cloud-alerting/
  - /docs/grafana-cloud/how-do-i/grafana-cloud-alerting/
  - /docs/grafana-cloud/legacy-alerting/grafana-cloud-alerting/
labels:
  products:
    - cloud
description: How to configure Alerting for Cloud
title: Set up Alerting for Cloud
weight: 100
---

# Set up Alerting for Cloud

Set up your implementation of Grafana Alerting for Cloud.

Grafana Cloud alerts are directly tied to metrics and log data.

They can be configured either using the UI or by uploading files containing Prometheus and Loki alert rules with mimirtool.

Grafana Cloud Alerting's Prometheus-style alerts are built by querying directly from the data source itself.

**Note:**

These are set up instructions for Grafana Alerting Cloud.

To set up Grafana Alerting for Open Source, see [Set up]({{< relref "../_index.md" >}}).

To set up Alerting, you need to:

1. Configure alert rules

   - Create Mimir/Loki-managed alert rules and recording rules

2. Configure contact points
   - Check the default contact point and update the email address
   - [Optional] Add new contact points and integrations
3. Configure notification policies

   - Check the default notification policy
   - [Optional] Add additional nested policies
   - [Optional] Add labels and label matchers to control alert routing

4. [Optional] Integrate with [Grafana OnCall](/docs/oncall/latest/integrations/grafana-alerting) and [Grafana Incident](/docs/grafana-cloud/incident/set-up)

## Advanced set up options

Grafana Alerting supports many additional configuration options, from configuring external Alertmanagers to routing Grafana-managed alerts outside of Grafana, to defining your alerting setup as code.

The following topics provide you with advanced configuration options for Grafana Alerting for Cloud.

### Provision alert rules using mimirtool

Use `mimirtool` to create and upload alert and recording rules to your Grafana Cloud instance.

Once created, you can view these alert and recordiing rules from within the Grafana Cloud Alerting page in the UI.

{{% admonition type="note" %}}
`mimirtool` does _not_ support Loki.
{{% /admonition %}}

Prometheus-style alerting is driven by your Grafana Cloud Metrics, Grafana Cloud Logs, and Grafana Cloud Alerts instances. The Metrics and Logs instance holds the rules definition, while the Alerts instance is in charge of routing and managing the alerts that fire from the Metrics and Logs instance. These are separate systems that must be individually configured in order for alerting to work correctly.

The following sections cover all of these concepts:

- How to upload alerting and recording rules definition to your Grafana Cloud Metrics instance
- How to upload alerting rules definition to your Grafana Cloud Logs instance
- How to configure an Alertmanager for your Grafana Cloud Alerts instance, giving you access to the Alertmanager UI.

**Note:** You need an API key with proper permissions. You can use the same API key for your Metric, Log, and Alerting instances.

#### Download and install mimirtool

`mimirtool` is a powerful command-line tool for interacting with Grafana Mimir, which powers Grafana Cloud Metrics and Alerts. Use `mimirtool` to upload your metric and log rules definition and the Alertmanager configuration using YAML files.

For more information, including installation instructions, see [Grafana Mimirtool](/docs/mimir/latest/operators-guide/tools/mimirtool).

{{% admonition type="note" %}}
For `mimirtool` to interact with Grafana Cloud, you must set the correct configuration variables. Set them using either environment variables or a command line flags.
{{% /admonition %}}

#### Upload rules definition to your Grafana Cloud Metrics and Logs instance

First, you'll need to upload your alerting and recording rules to your Metrics and Logs instance. You'll need the instance ID and the URL. These should be part of /orgs/`<yourOrgName>`/.

**Metrics instance**

Your Metrics instance is likely to be in the `us-central1` region. Its address would be in the form of [https://prometheus-us-central1.grafana.net](https://prometheus-us-central1.grafana.net).

**Logs instance**

Your Logs instance is likely to be in the `us-central1` region. Its address would be in the form of [https://logs-prod-us-central1.grafana.net](https://logs-prod-us-central1.grafana.net).

#### Use mimirtool

With your instance ID, URL, and API key you're now ready to upload your rules to your metrics instance. Use the following commands and files as a reference.

Below is an example alert and rule definition YAML file. Take note of the namespace key which replaces the concept of "files" in this context given each instance only supports 1 configuration file.

```yaml
# first_rules.yml
namespace: 'first_rules'
groups:
  - name: 'shopping_service_rules_and_alerts'
    rules:
      - alert: 'PromScrapeFailed'
        annotations:
          message: 'Prometheus failed to scrape a target {{ $labels.job }}  / {{ $labels.instance }}'
        expr: 'up != 1'
        for: '1m'
        labels:
          'severity': 'critical'
      - record: 'job:up:sum'
        expr: 'sum by(job) (up)'
```

Although both recording and alerting rules are defined under the key `rules` the difference between a rule and and alert is _generally_ (as there are others) whenever the key `record` or `alert` is defined.

With this file, you can run the following commands to upload your rules file in your Metrics or Logs instance. Keep in mind that these are example commands for your Metrics instance, and they use placeholders and command line flags. Follow a similar pattern for your Logs instances by switching the address to the correct one. The examples also assume that files are located in the same directory.

```bash
$ mimirtool rules load first_rules.yml \
--address=https://prometheus-us-central1.grafana.net \
--id=<yourID> \
--key=<yourKey>
```

Next, confirm that the rules were uploaded correctly by running:

```bash
$ mimirtool rules list \
--address=https://prometheus-us-central1.grafana.net \
--id=<yourID> \
--key=<yourKey>
```

Output is a list that shows you all the namespaces and rule groups for your instance ID:

```bash
Namespace   | Rule Group
first_rules | shopping_service_rules_and_alerts
```

You can also print the rules:

```bash
$ mimirtool rules print \
--address=https://prometheus-us-central1.grafana.net \
--id=<yourID> \
--key=<yourKey>
```

Output from the print command should look like this:

```yaml
first_rules:
  - name: shopping_service_rules_and_alerts
    interval: 0s
    rules:
      - alert: PromScrapeFailed
        expr: up != 1
        for: 1m
        labels:
          severity: critical
        annotations:
          message: Prometheus failed to scrape a target {{ $labels.job }}  / {{ $labels.instance }}
      - record: job:up:sum
        expr: sum by(job) (up)
```

### Add an external Alertmanager using mimirtool

To receive alerts you need to upload your Alertmanager configuration to your Grafana Cloud Alerts instance. Similar to the previous step, you need the corresponding instance ID, URL and API key. These should be part of /orgs/​`<yourOrgName>`/.

Your Alerts instance is likely to be in the `us-central1` region. Its address would be in the form of [https://alertmanager-us-central1.grafana.net](https://alertmanager-us-central1.grafana.net).

#### Use mimirtool

With your instance ID, URL, and API key you're now ready to upload your Alertmanager configuration to your Alerts instance. Use the following commands and files as a reference.

Ultimately, you'll need to [write your own](https://prometheus.io/docs/alerting/latest/configuration/) or adapt an [example config file](https://github.com/prometheus/alertmanager/blob/master/doc/examples/simple.yml) for alerts to be delivered.

Below is an example Alertmanager configuration. Please take that this not a working configuration, your alerts won't be delivered with the following configuration but your Alertmanager UI will be accessible.

```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'localhost:25'
  smtp_from: 'youraddress@example.org'
route:
  receiver: example-email
receivers:
  - name: example-email
    email_configs:
      - to: 'youraddress@example.org'
```

With this file, you can run the following commands to upload your Alertmanager configuration in your Alerts instance.

```bash
$ mimirtool alertmanager load alertmanager.yml \
--address=https://alertmanager-us-central1.grafana.net \
--id=<yourID> \
--key=<yourKey>
```

Then, confirm that the rules were uploaded correctly by running:

```bash
$ mimirtool alertmanager get \
--address=https://alertmanager-us-central1.grafana.net \
--id=<yourID> \
--key=<yourKey>
```

You should see output similar to the following:

```bash
global:
  smtp_smarthost: 'localhost:25'
  smtp_from: 'youraddress@example.org'
route:
  receiver: example-email
receivers:
 - name: example-email
   email_configs:
    - to: 'youraddress@example.org'
```

Finally, you can delete the configuration with:

```bash
$ mimirtool alertmanager delete \
--address=https://alertmanager-us-central1.grafana.net \
--id=<yourID> \
--key=<yourKey>
```

#### UI access

After you upload a working Alertmanager configuration file, you can access the Alertmanager UI at: https://alertmanager-us-central1.grafana.net/alertmanager.

### Provision alert rules using Terraform

For information on how to provision alert rule using Terraform, see [Provision alert rules using Terraform]({{< relref "../provision-alerting-resources/terraform-provisioning" >}}).
