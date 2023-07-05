---
title: Build a panel plugin with D3.js
description: how to use D3.js in your panel plugins.
weight: 200
keywords:
  - grafana
  - plugins
  - plugin
  - d3js
  - d3
  - panel
  - panel plugin
---

## Introduction

Panels are the building blocks of Grafana, and allow you to visualize data in different ways. This tutorial gives you a hands-on walkthrough of creating your own panel using [D3.js](https://d3js.org/).

For more information about panels, refer to the documentation on [Panels](/docs/grafana/latest/features/panels/panels/).

In this tutorial, you'll:

- Build a simple panel plugin to visualize a bar chart.
- Learn how to use D3.js to build a panel using data-driven transformations.

{{% class "prerequisite-section" %}}

### Prerequisites

- Grafana 7.0
- NodeJS 12.x
- yarn
  {{% /class %}}

## Set up your environment

{{< docs/shared lookup="tutorials/set-up-environment.md" source="grafana" version="latest" >}}

## Create a new plugin

{{< docs/shared lookup="tutorials/create-plugin.md" source="grafana" version="latest" >}}

## Data-driven documents

[D3.js](https://d3js.org/) is a JavaScript library for manipulating documents based on data. It lets you transform arbitrary data into HTML, and is commonly used for creating visualizations.

Wait a minute. Manipulating documents based on data? That's sounds an awful lot like React. In fact, much of what you can accomplish with D3 you can already do with React. So before we start looking at D3, let's see how you can create an SVG from data, using only React.

In **SimplePanel.tsx**, change `SimplePanel` to return an `svg` with a `rect` element.

```ts
export const SimplePanel = ({ options, data, width, height }: Props) => {
  const theme = useTheme();

  return (
    <svg width={width} height={height}>
      <rect x={0} y={0} width={10} height={10} fill={theme.palette.greenBase} />
    </svg>
  );
};
```

One single rectangle might not be very exciting, so let's see how you can create rectangles from data.

1. Create some data that we can visualize.

   ```ts
   const values = [4, 8, 15, 16, 23, 42];
   ```

1. Calculate the height of each bar based on the height of the panel.

   ```ts
   const barHeight = height / values.length;
   ```

1. Inside a SVG group, `g`, create a `rect` element for every value in the dataset. Each rectangle uses the value as its width.

   ```ts
   return (
     <svg width={width} height={height}>
       <g>
         {values.map((value, i) => (
           <rect x={0} y={i * barHeight} width={value} height={barHeight - 1} fill={theme.palette.greenBase} />
         ))}
       </g>
     </svg>
   );
   ```

1. Rebuild the plugin and reload your browser to see the changes you've made.

As you can see, React is perfectly capable of dynamically creating HTML elements. In fact, creating elements using React is often faster than creating them using D3.

So why would you use even use D3? In the next step, we'll see how you can take advantage of D3's data transformations.

## Transform data using D3.js

In this step, you'll see how you can transform data using D3 before rendering it using React.

D3 is already bundled with Grafana, and you can access it by importing the `d3` package. However, we're going to need the type definitions while developing.

1. Install the D3 type definitions:

   ```bash
   yarn add --dev @types/d3
   ```

1. Import `d3` in **SimplePanel.tsx**.

   ```ts
   import * as d3 from 'd3';
   ```

In the previous step, we had to define the width of each bar in pixels. Instead, let's use _scales_ from the D3 library to make the width of each bar depend on the width of the panel.

Scales are functions that map a range of values to another range of values. In this case, we want to map the values in our datasets to a position within our panel.

1. Create a scale to map a value between 0 and the maximum value in the dataset, to a value between 0 and the width of the panel. We'll be using this to calculate the width of the bar.

   ```ts
   const scale = d3
     .scaleLinear()
     .domain([0, d3.max(values) || 0.0])
     .range([0, width]);
   ```

1. Pass the value to the scale function to calculate the width of the bar in pixels.

   ```ts
   return (
     <svg width={width} height={height}>
       <g>
         {values.map((value, i) => (
           <rect x={0} y={i * barHeight} width={scale(value)} height={barHeight - 1} fill={theme.palette.greenBase} />
         ))}
       </g>
     </svg>
   );
   ```

As you can see, even if we're using React to render the actual elements, the D3 library contains useful tools that you can use to transform your data before rendering it.

## Add an axis

Another useful tool in the D3 toolbox is the ability to generate _axes_. Adding axes to our chart makes it easier for the user to understand the differences between each bar.

Let's see how you can use D3 to add a horizontal axis to your bar chart.

1. Create a D3 axis. Notice that by using the same scale as before, we make sure that the bar width aligns with the ticks on the axis.

   ```ts
   const axis = d3.axisBottom(scale);
   ```

1. Generate the axis. While D3 needs to generate the elements for the axis, we can encapsulate it by generating them within an anonymous function which we pass as a `ref` to a group element `g`.

   ```ts
   <g
     ref={(node) => {
       d3.select(node).call(axis as any);
     }}
   />
   ```

By default, the axis renders at the top of the SVG element. We'd like to move it to the bottom, but to do that, we first need to make room for it by decreasing the height of each bar.

1. Calculate the new bar height based on the padded height.

   ```ts
   const padding = 20;
   const chartHeight = height - padding;
   const barHeight = chartHeight / values.length;
   ```

1. Translate the axis by adding a transform to the `g` element.

   ```ts
   <g
     transform={`translate(0, ${chartHeight})`}
     ref={(node) => {
       d3.select(node).call(axis as any);
     }}
   />
   ```

Congrats! You've created a simple and responsive bar chart.

## Complete example

```ts
import React from 'react';
import { PanelProps } from '@grafana/data';
import { SimpleOptions } from 'types';
import { useTheme } from '@grafana/ui';
import * as d3 from 'd3';

interface Props extends PanelProps<SimpleOptions> {}

export const SimplePanel = ({ options, data, width, height }: Props) => {
  const theme = useTheme();

  const values = [4, 8, 15, 16, 23, 42];

  const scale = d3
    .scaleLinear()
    .domain([0, d3.max(values) || 0.0])
    .range([0, width]);

  const axis = d3.axisBottom(scale);

  const padding = 20;
  const chartHeight = height - padding;
  const barHeight = chartHeight / values.length;

  return (
    <svg width={width} height={height}>
      <g>
        {values.map((value, i) => (
          <rect x={0} y={i * barHeight} width={scale(value)} height={barHeight - 1} fill={theme.palette.greenBase} />
        ))}
      </g>
      <g
        transform={`translate(0, ${chartHeight})`}
        ref={(node) => {
          d3.select(node).call(axis as any);
        }}
      />
    </svg>
  );
};
```

## Summary

In this tutorial you built a panel plugin with D3.js.
