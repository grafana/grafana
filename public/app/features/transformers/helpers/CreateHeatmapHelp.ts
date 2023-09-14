import { getLinkToDocs } from './getLinkToDocs';

export const createHeatmapHelp = () => {
  return `
  Use this transformation to prepare histogram data to be visualized over time. Similar to the Heatmap panel, this transformation allows you to convert histogram metrics to buckets over time.

  #### X Bucket

  This setting determines how the x-axis is split into buckets.

  - **Size** - Specify a time interval in the input field. For example, a time range of '1h' makes the cells one hour wide on the x-axis.
  - **Count** - For non-time related series, use this option to define the number of elements in a bucket.

  #### Y Bucket

  This setting determines how the y-axis is split into buckets.

  - **Linear**
  - **Logarithmic** - Use a base 2 or base 10.
  - **Symlog** - A symmetrical logarithmic scale. Use a base 2 or base 10; allows negative values.
  ${getLinkToDocs()}
  `;
};
