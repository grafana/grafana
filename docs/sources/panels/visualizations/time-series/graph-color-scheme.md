+++
title = "Graph and color schemes "
keywords = ["grafana", "time series panel", "documentation", "guide", "graph"]
weight = 400
+++

# Graph and color schemes 

Under [Standard options]({{< relref "./standard-options.md" >}}) you find the [Color scheme]({{< relref "./standard-options.md#color-scheme" >}}) option. This option controls how fields and series gets their colors. 

## Classic palette 

The most common setup is to use the **Classic palette** for graphs. This scheme will automatically assign a color for each field or series based on it's order. So if the order of a field change in your query the color will also change. You can manually configure a color for a specific field using an override rule. 

## By value color schemes 

 > **Note:** Starting in v8.1 the Time series panel now supports by value color schemes like **From thresholds** of the gradient color schemes. 

 
