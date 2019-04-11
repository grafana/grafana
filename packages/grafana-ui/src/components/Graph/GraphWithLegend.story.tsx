import React from 'react';
import { storiesOf } from '@storybook/react';

import { select, text } from '@storybook/addon-knobs';
import { withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { GraphWithLegend } from './GraphWithLegend';

import { mockGraphWithLegendData } from './mockGraphWithLegendData';
import { StatID } from '../../utils/index';
import { action } from '@storybook/addon-actions';
import { LegendPlacement } from '../Legend/Legend';
const GraphWithLegendStories = storiesOf('UI/Graph/GraphWithLegend', module);
GraphWithLegendStories.addDecorator(withHorizontallyCenteredStory);

const getStoriesKnobs = () => {
  const statsToDisplay = select(
    'Stats to display',
    {
      none: [],
      'single (min)': ['min'],
      'multiple (min, max)': ['min', 'max'],
    },
    []
  ) as StatID[];

  const containerWidth = select(
    'Container width',
    {
      Small: '200px',
      Medium: '500px',
      'Full width': '100%',
    },
    '100%'
  );
  const containerHeight = select(
    'Container height',
    {
      Small: '200px',
      Medium: '300px',
      'Full height': '100%',
    },
    '200px'
  );

  const rightAxisSeries = text('Right y-axis series, i.e. A,C', '');

  const legendPlacement = select<LegendPlacement>(
    'Legend placement',
    {
      under: 'under',
      right: 'right',
    },
    'under'
  );

  return {
    statsToDisplay,
    containerWidth,
    containerHeight,
    rightAxisSeries,
    legendPlacement,
  };
};

GraphWithLegendStories.add('default', () => {
  const { containerWidth, containerHeight, statsToDisplay, rightAxisSeries, legendPlacement } = getStoriesKnobs();

  const props = mockGraphWithLegendData({
    stats: statsToDisplay,
    onSeriesColorChange: action('Series color changed'),
    onSeriesAxisToggle: action('Series y-axis changed'),
  });
  const series = props.series.map(s => {
    if (
      rightAxisSeries
        .split(',')
        .map(s => s.trim())
        .indexOf(s.label.split('-')[0]) > -1
    ) {
      s.useRightYAxis = true;
    }

    return s;
  });
  return (
    <div style={{ width: containerWidth, height: containerHeight }}>
      <GraphWithLegend {...props} placement={legendPlacement} series={series} />,
    </div>
  );
});
