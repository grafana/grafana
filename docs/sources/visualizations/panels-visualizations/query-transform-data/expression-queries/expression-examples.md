---
aliases:
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Expressions examples
title: Expressions examples
description: Practical expression examples from basic to advanced for common monitoring scenarios
weight: 55
refs:
  grafana-expressions:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/expression-queries/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/visualizations/panels-visualizations/query-transform-data/expression-queries/
  grafana-alerting:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/
---

# Expressions examples

This document provides practical expression examples for common monitoring and visualization scenarios.
Examples progress from basic to advanced, showing you how to solve real-world problems with Grafana Expressions.

For foundational concepts, refer to [Grafana expressions](ref:grafana-expressions).

## Basic examples

Start here if you're new to expressions. These examples demonstrate fundamental patterns you'll use frequently.

### Convert units

**Scenario:** Your metrics are in bytes, but you want to display them in gigabytes.

**Setup:**

- Query A (Prometheus): `node_memory_MemTotal_bytes`
- Expression B (Math): `$A / 1024 / 1024 / 1024`

**Result:** Memory values converted from bytes to gigabytes.

**Variations:**

- Bytes to megabytes: `$A / 1024 / 1024`
- Bytes to terabytes: `$A / 1024 / 1024 / 1024 / 1024`
- Milliseconds to seconds: `$A / 1000`
- Celsius to Fahrenheit: `$A * 9 / 5 + 32`

---

### Calculate a simple percentage

**Scenario:** Show what percentage of total memory is being used.

**Setup:**

- Query A (Prometheus): `node_memory_MemTotal_bytes`
- Query B (Prometheus): `node_memory_MemAvailable_bytes`
- Expression C (Math): `($A - $B) / $A * 100`

**Result:** Memory usage as a percentage (0-100).

**Tip:** This pattern works for any "used / total \* 100" calculation.

---

### Get the current (latest) value

**Scenario:** Display the most recent temperature reading in a stat panel.

**Setup:**

- Query A (InfluxDB): Temperature sensor time series data
- Expression B (Reduce): Input `$A`, Function: **Last**

**Result:** Single number showing the most recent value from the time series.

**When to use:** Stat panels, gauges, or any visualization that needs a single current value.

---

### Calculate an average over time

**Scenario:** Show the average CPU usage over the dashboard time range.

**Setup:**

- Query A (Prometheus): `node_cpu_seconds_total{mode="idle"}`
- Expression B (Reduce): Input `$A`, Function: **Mean**

**Result:** Average CPU value across the selected time range.

**Note:** Each series (each CPU core, each host) produces its own average, preserving labels.

---

### Find maximum or minimum values

**Scenario:** Identify the peak memory usage in the last 24 hours.

**Setup:**

- Query A (Prometheus): `node_memory_MemUsed_bytes` (last 24 hours)
- Expression B (Reduce): Input `$A`, Function: **Max**

**Result:** Peak memory usage value for each host.

**Variations:**

- Use **Min** to find the lowest value
- Use **Count** to see how many data points exist

---

### Simple threshold check

**Scenario:** Create a binary indicator showing whether CPU is above 80%.

**Setup:**

- Query A (Prometheus): `100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`
- Expression B (Math): `$A > 80`

**Result:** Returns `1` when CPU exceeds 80%, `0` otherwise. Useful for alerting or status indicators.

---

## Intermediate examples

These examples combine multiple operations and handle more complex scenarios.

### Calculate error rate percentage

**Scenario:** Display HTTP error rate as a percentage of total requests.

**Setup:**

- Query A (Prometheus): `sum(rate(http_requests_total{status=~"5.."}[5m]))`
- Query B (Prometheus): `sum(rate(http_requests_total[5m]))`
- Expression C (Math): `$A / $B * 100`

**Result:** Error rate percentage across all endpoints.

**Handling division by zero:** If there are zero requests, this produces infinity. To handle this:

- Expression C (Math): `$B > 0 ? ($A / $B * 100) : 0`

This returns 0 when there are no requests instead of infinity.

---

### Calculate available disk space

**Scenario:** Show available disk space as a percentage for capacity planning.

**Setup:**

- Query A (Prometheus): `node_filesystem_size_bytes{mountpoint="/"}`
- Query B (Prometheus): `node_filesystem_avail_bytes{mountpoint="/"}`
- Expression C (Math): `$B / $A * 100`

**Result:** Percentage of disk space available (not used) for each host's root filesystem.

**For alerting:** Add an alert when available space drops below 10%:

- Expression D (Math): `$C < 10`

---

### Aggregate across multiple servers

**Scenario:** Calculate total requests per second across all web servers.

**Setup:**

- Query A (Prometheus): `rate(http_requests_total{job="webservers"}[5m])`
- Expression B (Reduce): Input `$A`, Function: **Sum**

**Result:** Total requests per second across all servers combined into a single value.

**Alternative:** To get the average per server instead:

- Expression B (Reduce): Input `$A`, Function: **Mean**

---

### Combine metrics from different data sources

**Scenario:** Calculate efficiency by dividing application throughput (Prometheus) by infrastructure cost metric (CloudWatch).

**Setup:**

- Query A (Prometheus): `sum(rate(processed_jobs_total[5m]))`
- Query B (CloudWatch): EC2 instance cost metric
- Expression C (Resample): Input `$A`, Resample to: `1m`, Downsample: Mean
- Expression D (Resample): Input `$B`, Resample to: `1m`, Downsample: Mean
- Expression E (Math): `$C / $D`

**Result:** Jobs processed per dollar (or cost unit), showing application efficiency.

**Why resample:** Different data sources often have different collection intervals. Resampling ensures timestamps align for math operations.

---

### Compare hosts to fleet average

**Scenario:** Identify hosts performing worse than the fleet average.

**Setup:**

- Query A (Prometheus): `node_cpu_usage_percent` (returns one series per host)
- Expression B (Reduce): Input `$A`, Function: **Mean** (fleet average)
- Expression C (Math): `$A - $B`

**Result:** Each host shows how much above or below the fleet average they are. Positive values indicate above-average CPU usage.

---

### Filter invalid data

**Scenario:** Calculate average response time, ignoring any null or NaN values in the data.

**Setup:**

- Query A (Time series): Response time data with occasional gaps
- Expression B (Reduce): Input `$A`, Function: **Mean**, Mode: **Drop non-numeric**

**Result:** Clean average that ignores invalid data points.

**Alternative modes:**

- **Strict:** Returns NaN if any value is invalid (use when data quality matters)
- **Replace non-numeric:** Substitutes a specific value for invalid data points

---

### Calculate rate of change

**Scenario:** Show how quickly memory usage is increasing or decreasing.

**Setup:**

- Query A (Prometheus): `node_memory_MemUsed_bytes`
- Query B (Prometheus): `node_memory_MemUsed_bytes offset 5m`
- Expression C (Math): `$A - $B`

**Result:** Bytes of memory change over the last 5 minutes. Positive = increasing, negative = decreasing.

**As a percentage change:**

- Expression C (Math): `($A - $B) / $B * 100`

---

## Advanced examples

These examples demonstrate complex multi-step calculations and sophisticated alerting patterns.

### Compare current value to 24-hour average

**Scenario:** Highlight when current traffic is significantly above or below the daily norm.

**Setup:**

- Query A (Prometheus): `sum(rate(http_requests_total[24h]))` (historical average)
- Query B (Prometheus): `sum(rate(http_requests_total[5m]))` (current rate)
- Expression C (Reduce): Input `$A`, Function: **Mean**
- Expression D (Math): `($B - $C) / $C * 100`

**Result:** Percentage difference from the 24-hour average. +50 means 50% above normal, -30 means 30% below normal.

**Use cases:**

- Detect traffic anomalies
- Identify unusual load patterns
- Trigger alerts for significant deviations

---

### Calculate service level indicator (SLI)

**Scenario:** Calculate the percentage of requests meeting your latency target (under 200ms).

**Setup:**

- Query A (Prometheus): `sum(rate(http_request_duration_seconds_bucket{le="0.2"}[5m]))`
- Query B (Prometheus): `sum(rate(http_request_duration_seconds_count[5m]))`
- Expression C (Math): `$A / $B * 100`

**Result:** Percentage of requests completing in under 200ms (your SLI).

**For SLO alerting:** Alert when SLI drops below 99%:

- Expression D (Reduce): Input `$C`, Function: **Mean**
- Expression E (Math): `$D < 99`

---

### Multi-host alerts with reduction

**Scenario:** Alert when average CPU across all production servers exceeds 80%.

**Setup:**

- Query A (Prometheus): `100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle",env="production"}[5m])) * 100)`
- Expression B (Reduce): Input `$A`, Function: **Mean** (average across all hosts)
- Expression C (Math): `$B > 80`

**Result:** Single alert that fires when the fleet average crosses the threshold, not individual host alerts.

**Alternative - alert on any host:**

- Expression B (Reduce): Input `$A`, Function: **Max**

This alerts when any single host exceeds 80%.

---

### Calculate compound metrics

**Scenario:** Calculate Apdex score (Application Performance Index) from response time buckets.

**Setup:**

- Query A (Prometheus): `sum(rate(http_request_duration_seconds_bucket{le="0.5"}[5m]))` (satisfied: <500ms)
- Query B (Prometheus): `sum(rate(http_request_duration_seconds_bucket{le="2.0"}[5m]))` (tolerating: <2s)
- Query C (Prometheus): `sum(rate(http_request_duration_seconds_count[5m]))` (total)
- Expression D (Math): `($A + ($B - $A) / 2) / $C`

**Result:** Apdex score from 0 to 1, where 1 is perfect user satisfaction.

**Formula explained:** Apdex = (Satisfied + Tolerating/2) / Total

---

### Detect sustained conditions

**Scenario:** Alert only when CPU has been high for at least 5 minutes, not just a brief spike.

**Setup:**

- Query A (Prometheus): `avg_over_time(node_cpu_usage_percent[5m])`
- Expression B (Reduce): Input `$A`, Function: **Mean**
- Expression C (Math): `$B > 80`

**Result:** Alerts only fire when the 5-minute average exceeds the threshold, filtering out brief spikes.

**Alternative approach using count:**

- Query A: `node_cpu_usage_percent`
- Expression B (Math): `$A > 80`
- Expression C (Reduce): Input `$B`, Function: **Sum** (counts "1" values where condition is true)
- Expression D (Math): `$C > 5`

This alerts when more than 5 data points in the range exceed the threshold.

---

### Correlate metrics across systems

**Scenario:** Calculate orders processed per database query to measure backend efficiency.

**Setup:**

- Query A (Prometheus - App metrics): `sum(rate(orders_processed_total[5m]))`
- Query B (MySQL data source): Database queries per second from performance schema
- Expression C (Resample): Input `$A`, Resample to: `30s`, Downsample: Mean
- Expression D (Resample): Input `$B`, Resample to: `30s`, Downsample: Mean
- Expression E (Math): `$C / $D`

**Result:** Orders per database query, showing how efficiently your backend processes orders.

**Lower is better:** Fewer queries per order means more efficient database usage.

---

### Ratio-based alerts with baseline

**Scenario:** Alert when error ratio increases by more than 2x compared to yesterday's baseline.

**Setup:**

- Query A (Prometheus): `sum(rate(http_errors_total[5m]))` (current errors)
- Query B (Prometheus): `sum(rate(http_requests_total[5m]))` (current requests)
- Query C (Prometheus): `sum(rate(http_errors_total[5m] offset 24h))` (yesterday's errors)
- Query D (Prometheus): `sum(rate(http_requests_total[5m] offset 24h))` (yesterday's requests)
- Expression E (Math): `$A / $B` (current error rate)
- Expression F (Math): `$C / $D` (baseline error rate)
- Expression G (Reduce): Input `$E`, Function: **Mean**
- Expression H (Reduce): Input `$F`, Function: **Mean**
- Expression I (Math): `$G / $H > 2`

**Result:** Alerts when today's error rate is more than double yesterday's rate.

**Why this matters:** Absolute thresholds don't account for normal variation. Ratio-based alerting adapts to your system's baseline behavior.

---

### Calculate percentile-based thresholds

**Scenario:** Alert when response time exceeds the 95th percentile baseline.

**Setup:**

- Query A (Prometheus): `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))`
- Query B (Prometheus): `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[1h])) by (le))`
- Expression C (Reduce): Input `$A`, Function: **Last** (current p95)
- Expression D (Reduce): Input `$B`, Function: **Mean** (baseline p95)
- Expression E (Math): `$C > $D * 1.5`

**Result:** Alerts when current p95 latency exceeds 1.5x the hourly baseline.

---

### Weighted scores across metrics

**Scenario:** Create a composite health score from multiple metrics (CPU, memory, disk, network).

**Setup:**

- Query A: CPU usage percentage (0-100)
- Query B: Memory usage percentage (0-100)
- Query C: Disk usage percentage (0-100)
- Query D: Network saturation percentage (0-100)
- Expression E (Reduce): Input `$A`, Function: **Mean**
- Expression F (Reduce): Input `$B`, Function: **Mean**
- Expression G (Reduce): Input `$C`, Function: **Mean**
- Expression H (Reduce): Input `$D`, Function: **Mean**
- Expression I (Math): `($E * 0.3) + ($F * 0.25) + ($G * 0.25) + ($H * 0.2)`

**Result:** Weighted health score from 0-100 where lower is healthier. Weights reflect relative importance (CPU 30%, Memory 25%, Disk 25%, Network 20%).

**For alerting:**

- Expression J (Math): `$I > 70`

Alert when composite score indicates degraded health.

---

### Conditional logic with fallbacks

**Scenario:** Show error rate, but display 0 instead of infinity when there are no requests.

**Setup:**

- Query A (Prometheus): `sum(rate(http_errors_total[5m]))`
- Query B (Prometheus): `sum(rate(http_requests_total[5m]))`
- Expression C (Math): `$B > 0 ? ($A / $B * 100) : 0`

**Result:** Error rate percentage that safely handles zero-request periods.

**Conditional syntax:** `condition ? value_if_true : value_if_false`

**More examples:**

- Cap values at 100: `$A > 100 ? 100 : $A`
- Convert negative to zero: `$A < 0 ? 0 : $A`
- Binary classification: `$A > threshold ? 1 : 0`

---

### Time-window comparison for trend detection

**Scenario:** Detect if metrics are trending up or down by comparing recent data to slightly older data.

**Setup:**

- Query A (Prometheus): `avg_over_time(http_requests_total[5m])`
- Query B (Prometheus): `avg_over_time(http_requests_total[5m] offset 10m)`
- Expression C (Reduce): Input `$A`, Function: **Mean**
- Expression D (Reduce): Input `$B`, Function: **Mean**
- Expression E (Math): `($C - $D) / $D * 100`

**Result:** Percentage change in requests between the last 5 minutes and the previous 5-minute window.

**Interpretation:**

- Positive values: Traffic increasing
- Negative values: Traffic decreasing
- Values near 0: Traffic stable

**Use case:** Detect rapid traffic changes that might indicate problems or attacks.

---

## Tips for expression development

Follow these best practices to build reliable, maintainable expressions in your visualizations and alerts.

### Start simple and iterate

Begin with basic operations and verify each step works before adding complexity. Use the Query Inspector to see intermediate results.

### Name your queries clearly

While RefIDs default to letters, you can use descriptive names. Referencing `${errors}` and `${total_requests}` is clearer than `$A` and `$B`.

### Test with realistic time ranges

Expressions may behave differently with various time ranges. Test with the same ranges you'll use in production dashboards or alerts.

### Handle edge cases

Consider what happens when:

- Data is missing (NoData)
- Values are zero (division by zero)
- Metrics haven't been collected yet
- Time series have different numbers of points

### Document complex expressions

Add panel descriptions or annotation text explaining what complex expressions calculate and why.

### Monitor expression performance

If dashboards become slow, check if expressions are processing too much data. Consider moving heavy aggregations to recording rules or data source queries.
