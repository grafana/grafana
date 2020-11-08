import { toDataFrame } from '@grafana/data';
import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { GraphNG } from './GraphNG';
import { dateTime } from '@grafana/data';
import { LegendDisplayMode } from '../Legend/Legend';

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

  seriesA.fields[1].config.custom = { line: { show: true } };

  return (
    <GraphNG
      data={[seriesA]}
      width={600}
      height={400}
      timeRange={{
        from: dateTime(1546372800000),
        to: dateTime(1546380000000),
        raw: {
          from: dateTime(1546372800000),
          to: dateTime(1546380000000),
        },
      }}
      legend={{ isVisible: false, displayMode: LegendDisplayMode.List, placement: 'bottom' }}
      timeZone="browser"
    ></GraphNG>
  );
};
