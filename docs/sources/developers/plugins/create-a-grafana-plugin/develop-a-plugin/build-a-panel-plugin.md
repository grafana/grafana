---
title: Build a panel plugin
description: Learn how to create a custom visualization for your dashboards.
weight: 100
keywords:
  - grafana
  - plugins
  - plugin
  - visualization
  - custom visualization
  - dashboard
  - dashboards
---

## Introduction

Panels are the building blocks of Grafana. They allow you to visualize data in different ways. While Grafana has several types of panels already built-in, you can also build your own panel, to add support for other visualizations.

For more information about panels, refer to the documentation on [Panels](/docs/grafana/latest/panels/).

{{% class "prerequisite-section" %}}

### Prerequisites

- Grafana >=7.0
- NodeJS >=14
- yarn
  {{% /class %}}

## Set up your environment

{{< docs/shared lookup="tutorials/set-up-environment.md" source="grafana" version="latest" >}}

## Create a new plugin

{{< docs/shared lookup="tutorials/create-plugin.md" source="grafana" version="latest" >}}

## Anatomy of a plugin

{{< docs/shared lookup="tutorials/plugin-anatomy.md" source="grafana" version="latest" >}}

## Panel plugins

Since Grafana 6.x, panels are [ReactJS components](https://reactjs.org/docs/components-and-props.html).

Prior to Grafana 6.0, plugins were written in [AngularJS](https://angular.io/). Even though we still support plugins written in AngularJS, we highly recommend that you write new plugins using ReactJS.

### Panel properties

The [PanelProps](https://github.com/grafana/grafana/blob/747b546c260f9a448e2cb56319f796d0301f4bb9/packages/grafana-data/src/types/panel.ts#L27-L40) interface exposes runtime information about the panel, such as panel dimensions, and the current time range.

You can access the panel properties through `props`, as seen in your plugin.

**src/SimplePanel.tsx**

```js
const { options, data, width, height } = props;
```

### Development workflow

Next, you'll learn the basic workflow of making a change to your panel, building it, and reloading Grafana to reflect the changes you made.

First, you need to add your panel to a dashboard:

1. Open Grafana in your browser.
1. Create a new dashboard, and add a new panel.
1. Select your panel from the list of visualization types.
1. Save the dashboard.

Now that you can view your panel, try making a change to the panel plugin:

1. In `SimplePanel.tsx`, change the fill color of the circle.
1. Run `yarn dev` to build the plugin.
1. In the browser, reload Grafana with the new changes.

## Add panel options

Sometimes you want to offer the users of your panel an option to configure the behavior of your plugin. By configuring _panel options_ for your plugin, your panel will be able to accept user input.

In the previous step, you changed the fill color of the circle in the code. Let's change the code so that the plugin user can configure the color from the panel editor.

#### Add an option

Panel options are defined in a _panel options object_. `SimpleOptions` is an interface that describes the options object.

1. In `types.ts`, add a `CircleColor` type to hold the colors the users can choose from:

   ```
   type CircleColor = 'red' | 'green' | 'blue';
   ```

1. In the `SimpleOptions` interface, add a new option called `color`:

   ```
   color: CircleColor;
   ```

Here's the updated options definition:

**src/types.ts**

```ts
type SeriesSize = 'sm' | 'md' | 'lg';
type CircleColor = 'red' | 'green' | 'blue';

// interface defining panel options type
export interface SimpleOptions {
  text: string;
  showSeriesCount: boolean;
  seriesCountSize: SeriesSize;
  color: CircleColor;
}
```

#### Add an option control

To change the option from the panel editor, you need to bind the `color` option to an _option control_.

Grafana supports a range of option controls, such as text inputs, switches, and radio groups.

Let's create a radio control and bind it to the `color` option.

1. In `src/module.ts`, add the control at the end of the builder:

   ```ts
   .addRadio({
     path: 'color',
     name: 'Circle color',
     defaultValue: 'red',
     settings: {
       options: [
         {
           value: 'red',
           label: 'Red',
         },
         {
           value: 'green',
           label: 'Green',
         },
         {
           value: 'blue',
           label: 'Blue',
         },
       ],
     }
   });
   ```

   The `path` is used to bind the control to an option. You can bind a control to nested option by specifying the full path within a options object, for example `colors.background`.

Grafana builds an options editor for you and displays it in the panel editor sidebar in the **Display** section.

#### Use the new option

You're almost done. You've added a new option and a corresponding control to change the value. But the plugin isn't using the option yet. Let's change that.

1. To convert option value to the colors used by the current theme, add a `switch` statement right before the `return` statement in `SimplePanel.tsx`.

   **src/SimplePanel.tsx**

   ```ts
   let color: string;
   switch (options.color) {
     case 'red':
       color = theme.palette.redBase;
       break;
     case 'green':
       color = theme.palette.greenBase;
       break;
     case 'blue':
       color = theme.palette.blue95;
       break;
   }
   ```

1. Configure the circle to use the color.

   ```ts
   <g>
     <circle style={{ fill: color }} r={100} />
   </g>
   ```

Now, when you change the color in the panel editor, the fill color of the circle changes as well.

## Create dynamic panels using data frames

Most panels visualize dynamic data from a Grafana data source. In this step, you'll create one circle per series, each with a radius equal to the last value in the series.

> To use data from queries in your panel, you need to set up a data source. If you don't have one available, you can use the [TestData](/docs/grafana/latest/features/datasources/testdata) data source while developing.

The results from a data source query within your panel are available in the `data` property inside your panel component.

```ts
const { data } = props;
```

`data.series` contains the series returned from a data source query. Each series is represented as a data structure called _data frame_. A data frame resembles a table, where data is stored by columns, or _fields_, instead of rows. Every value in a field share the same data type, such as string, number, or time.

Here's an example of a data frame with a time field, `Time`, and a number field, `Value`:

| Time          | Value |
| ------------- | ----- |
| 1589189388597 | 32.4  |
| 1589189406480 | 27.2  |
| 1589189513721 | 15.0  |

Let's see how you can retrieve data from a data frame and use it in your visualization.

1. Get the last value of each field of type `number`, by adding the following to `SimplePanel.tsx`, before the `return` statement:

   ```ts
   const radii = data.series
     .map((series) => series.fields.find((field) => field.type === 'number'))
     .map((field) => field?.values.get(field.values.length - 1));
   ```

   `radii` will contain the last values in each of the series that are returned from a data source query. You'll use these to set the radius for each circle.

1. Change the `svg` element to the following:

   ```ts
   <svg
     className={styles.svg}
     width={width}
     height={height}
     xmlns="http://www.w3.org/2000/svg"
     xmlnsXlink="http://www.w3.org/1999/xlink"
     viewBox={`0 -${height / 2} ${width} ${height}`}
   >
     <g fill={color}>
       {radii.map((radius, index) => {
         const step = width / radii.length;
         return <circle r={radius} transform={`translate(${index * step + step / 2}, 0)`} />;
       })}
     </g>
   </svg>
   ```

   Note how we're creating a `<circle>` element for each value in `radii`:

   ```ts
   {
     radii.map((radius, index) => {
       const step = width / radii.length;
       return <circle r={radius} transform={`translate(${index * step + step / 2}, 0)`} />;
     });
   }
   ```

   We use the `transform` here to distribute the circle horizontally within the panel.

1. Rebuild your plugin and try it out by adding multiple queries to the panel. Refresh the dashboard.

If you want to know more about data frames, check out our introduction to [Data frames](/docs/grafana/latest/developers/plugins/data-frames/).

## Summary

In this tutorial you learned how to create a custom visualization for your dashboards.
