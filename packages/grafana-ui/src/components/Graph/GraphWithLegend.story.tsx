import React from 'react';
import { storiesOf } from '@storybook/react';

import { select, text } from '@storybook/addon-knobs';
import { withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { GraphWithLegend } from './GraphWithLegend';

import { mockGraphWithLegendData } from './mockGraphWithLegendData';
import { action } from '@storybook/addon-actions';
import { LegendPlacement, LegendDisplayMode } from '../Legend/Legend';
const GraphWithLegendStories = storiesOf('Visualizations/Graph/GraphWithLegend', module);
GraphWithLegendStories.addDecorator(withHorizontallyCenteredStory);

const getStoriesKnobs = () => {
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
      Medium: '400px',
      'Full height': '100%',
    },
    '400px'
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
  const renderLegendAsTable = select(
    'Render legend as',
    {
      list: false,
      table: true,
    },
    false
  );

  return {
    containerWidth,
    containerHeight,
    rightAxisSeries,
    legendPlacement,
    renderLegendAsTable,
  };
};

GraphWithLegendStories.add('default', () => {
  const { containerWidth, containerHeight, rightAxisSeries, legendPlacement, renderLegendAsTable } = getStoriesKnobs();

  const props = mockGraphWithLegendData({
    onSeriesColorChange: action('Series color changed'),
    onSeriesAxisToggle: action('Series y-axis changed'),
    displayMode: renderLegendAsTable ? LegendDisplayMode.Table : LegendDisplayMode.List,
  });
  const series = props.series.map(s => {
    if (
      rightAxisSeries
        .split(',')
        .map(s => s.trim())
        .indexOf(s.label.split('-')[0]) > -1
    ) {
      s.yAxis = 2;
    }

    return s;
  });
  return (
    <div style={{ width: containerWidth, height: containerHeight }}>
      <GraphWithLegend {...props} placement={legendPlacement} series={series} />,
    </div>
  );
});
