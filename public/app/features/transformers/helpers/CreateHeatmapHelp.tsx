import React from 'react';

const ulPadding = { paddingLeft: 30 };

export const CreateHeatmapHelp = () => {
  return (
    <div>
      <p>
        Use this transformation to prepare histogram data to be visualized over time. Similar to the Heatmap panel, this
        transformation allows you to convert histogram metrics to buckets over time.
      </p>
      <h4>X Bucket</h4>
      <p>This setting determines how the x-axis is split into buckets.</p>
      <ul style={ulPadding}>
        <li>
          <strong>Size</strong> - Specify a time interval in the input field. For example, a time range of{' '}
          <code>1h</code> makes the cells one hour wide on the x-axis.
        </li>
        <li>
          <strong>Count</strong> - For non-time related series, use this option to define the number of elements in a
          bucket.
        </li>
      </ul>
      <br />
      <h4>Y Bucket</h4>
      <p>This setting determines how the y-axis is split into buckets.</p>
      <ul style={ulPadding}>
        <li>
          <strong>Linear</strong>
        </li>
        <li>
          <strong>Logarithmic</strong> - Use a base 2 or base 10.
        </li>
        <li>
          <strong>Symlog</strong> - A symmetrical logarithmic scale. Use a base 2 or base 10; allows negative values.
        </li>
      </ul>
    </div>
  );
};
