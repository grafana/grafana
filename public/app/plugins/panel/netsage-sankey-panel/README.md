# NetSage Sankey Grafana Plugin

[![CI](https://github.com/netsage-project/netsage-sankey-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/netsage-project/netsage-sankey-panel/actions/workflows/ci.yml)
[![Release](https://github.com/netsage-project/netsage-sankey-panel/actions/workflows/release.yml/badge.svg)](https://github.com/netsage-project/netsage-sankey-panel/actions/workflows/release.yml)

This is a panel plugin for generating Sankey diagrams in Grafana 7.0+. Sankey diagrams are good for visualizing flow data and the width of the flows will be proportionate to the selected metric.

![](https://github.com/netsage-project/netsage-sankey-panel/blob/master/src/img/sankey2.png?raw=true)

## How it works

The sankey panel requires at least 2 columns of data, a source and destination for the flows. This means your query should group your data into at least two groups. The screenshot above shows data grouped by source country, then by destination county.
The panel will draw links from the first column of data points, to the last in order of the query. The thickness of the links will be proportionate to the value as assigned by the metric in the query.

![](https://github.com/netsage-project/netsage-sankey-panel/blob/master/src/img/sankey3.png?raw=true)

## Customizing

- **Links:** There are currently two options for link color: multi or single. It is multi-colored by default. To choose a single color for the links, toggle the "Single Link color only" option and choose your color from Grafana's color picker.
- **Nodes:** You can change the color of the rectangular nodes by changing the "Node color" option
- **Node Width** The width of the nodes can be adjusted with the "Node Width" slider or entering a number in the input box. This number must be an integer.
- **Node Padding** The vertical padding between nodes can be adjusted with the "Node Padding" slider or entering a number in the input box. This number must be an integer. If your links are too skinny, try adjusting this number
- **Headers** The column headers can be changed by using a Display Name override in the editor panel. They will be the same color you choose for Text color
- **Sankey Layout** The layout of the sankey links can be adjusted slightly using the "Layout iteration" slider. This number must be an integer and is the number of relaxation iterations used to generate the layout.
