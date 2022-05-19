+++
aliases = ["/docs/grafana/latest/alerting/alerting-limitations/"]
title = "Limitations"
weight = 552
+++

# Limitations

- Grafana alerting system can retrieve rules from all available Prometheus, Loki, and Alertmanager data sources. It might not be able to fetch alerting rules from all other supported data sources at this time.
- We aim to support the latest two minor versions of both Prometheus and Alertmanager. We cannot guarantee that older versions will work. As an example, if the current Prometheus version is `2.31.1`, we support >= `2.29.0`.
