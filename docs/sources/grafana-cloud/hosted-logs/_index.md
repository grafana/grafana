+++
title = "Hosted Logs"
description = ""
keywords = ["Grafana", "Loki", "Logs", "Aggregation"]

[menu.grafana-cloud]
identifier = "hosted_logs"
+++

# Hosted logs

Let Grafana host Loki, your new logging solution.

[Loki](https://grafana.com/loki) is a horizontally-scalable, highly-available, multi-tenant log aggregation system inspired by [Prometheus](https://prometheus.io/).
It is designed to be very cost effective and easy to operate.
It does not index the contents of the logs, but rather a set of labels for each log stream.

Compared to other log aggregation systems, Loki:

- Does not do full text indexing on logs. By storing compressed, unstructured logs and only indexing metadata, Loki is simpler to operate and cheaper to run.
- Indexes and groups log streams using the same labels you’re already using with Prometheus, enabling you to seamlessly switch between metrics and logs using the same labels that you’re already using with Prometheus.
- Is an especially good fit for storing [Kubernetes](https://kubernetes.io/) Pod logs. Metadata such as Pod labels is automatically scraped and indexed.
- Has native support in Grafana (needs Grafana v6.0).

A Loki-based logging stack consists of 3 components:

- `promtail` is the agent, responsible for gathering logs and sending them to Loki.
- `loki` is the main server, responsible for storing logs and processing queries.
- [Grafana](https://github.com/grafana/grafana) for querying and displaying the logs.

Loki is like Prometheus, but for logs: we prefer a multidimensional label-based approach to indexing, and want a single-binary, easy to operate system with no dependencies.
Loki differs from Prometheus by focussing on logs instead of metrics, and delivering logs via push, instead of pull.

### Loki documentation

- [API documentation](https://github.com/grafana/loki/blob/master/docs/api.md) for alternative ways of getting logs into Loki.
- [Operations](https://github.com/grafana/loki/tree/master/docs/operations) for important aspects of running Loki.
- [Troubleshooting](https://github.com/grafana/loki/blob/master/docs/getting-started/troubleshooting.md) for help around frequent error messages.

## Get help

If you have any questions or feedback regarding Loki:

- Ask a question on the Loki Slack channel. To invite yourself to the Grafana Slack, visit [http://slack.raintank.io/](http://slack.raintank.io/) and join the #loki channel.
- [File an issue](https://github.com/grafana/loki/issues/new) for bugs, issues and feature suggestions.
- Send an email to [lokiproject@googlegroups.com](mailto:lokiproject@googlegroups.com), or use the [web interface](https://groups.google.com/forum/#!forum/lokiproject).
- UI issues should be filed directly in [Grafana](https://github.com/grafana/grafana/issues/new).

Your feedback is always welcome.

## Further reading

- The original [design doc](https://docs.google.com/document/d/11tjK_lvp1-SVsFZjgOTr1vV3-q6vBAsZYIQ5ZeYBkyM/view) for Loki is a good source for discussion of the motivation and design decisions.
- Goutham Veeramachaneni's blog post "[Loki: Prometheus-inspired, open source logging for cloud natives](https://grafana.com/blog/2018/12/12/loki-prometheus-inspired-open-source-logging-for-cloud-natives/)" on details of the Loki architectire.
- David Kaltschmidt's blog post "[Closer look at Grafana's user interface for Loki](https://grafana.com/blog/2019/01/02/closer-look-at-grafanas-user-interface-for-loki/)" on the ideas that went into the logging user interface.
