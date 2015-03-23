---
page_title: Performance Tips
page_description: Grafana performance tips
page_keywords: grafana, performance, documentation
---

# Performance tips

## Graphite

Graphite 0.9.13 adds a much needed feature to the json rendering API that is very important for Grafana. If you are experiance slow
load & rendering times for large time ranges then it is most likely caused by running Graphite 0.9.12 or lower. The latest version
of Graphite adds a maxDataPoints parameter to the json render API, without this feature Graphite can return hundreds of thousands of data points per graph, which
can hang your browser. Be sue to upgrade to [0.9.13](http://graphite.readthedocs.org/en/latest/releases/0_9_13.html).


