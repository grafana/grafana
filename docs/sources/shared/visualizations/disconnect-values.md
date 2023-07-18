---
title: Disconnect values
---

### Disconnect values

Choose whether to set a threshold above which values in the data should be disconnected.

{{< figure src="/media/docs/grafana/screenshot-grafana-10-1-disconnect-values.png" max-width="750px" >}}

- **Never:** Time series data points in the the data are never disconnected.
- **Threshold:** Specify a threshold above which values in the data are disconnected. This can be useful when desired values in the data are of a known size and/or within a known range, and values outside this range should no longer be connected.
