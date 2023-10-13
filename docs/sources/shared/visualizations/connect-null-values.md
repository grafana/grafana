---
title: Connect null values
---

### Connect null values

Choose how null values, which are gaps in the data, appear on the graph. Null values can be connected to form a continuous line or set to a threshold above which gaps in the data are no longer connected.

![Connect null values option](/static/img/docs/time-series-panel/connect-null-values-option-v9.png)

- **Never:** Time series data points with gaps in the the data are never connected.
- **Always:** Time series data points with gaps in the the data are always connected.
- **Threshold:** Specify a threshold above which gaps in the data are no longer connected. This can be useful when the connected gaps in the data are of a known size and/or within a known range, and gaps outside this range should no longer be connected.
