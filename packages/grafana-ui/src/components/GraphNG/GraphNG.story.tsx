import { toDataFrame } from '@grafana/data';
import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { GraphNG } from './GraphNG';
import { dateTime } from '@grafana/data';

export default {
  title: 'Visualizations/GraphNG',
  component: GraphNG,
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

export const Lines = () => {
  const seriesA = toDataFrame({
    target: 'SeriesA',
    datapoints: [
      [1546372800000, 10],
      [1546376400000, 20],
      [1546380000000, 10],
    ],
  });

  return (
    <GraphNG
      data={[seriesA]}
      width={400}
      height={600}
      timeRange={{
        from: dateTime(1546372800000),
        to: dateTime(1546380000000),
        raw: {
          from: dateTime(1546372800000),
          to: dateTime(1546380000000),
        },
      }}
      timeZone="browser"
    />
  );
};
