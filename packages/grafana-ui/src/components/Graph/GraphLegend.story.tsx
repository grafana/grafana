import React from 'react';
import { storiesOf } from '@storybook/react';

import { GraphLegend } from './GraphLegend';
import { action } from '@storybook/addon-actions';
import { select, number } from '@storybook/addon-knobs';
import { withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { generateLegendItems } from '../Legend/Legend.story';
import { LegendPlacement, LegendDisplayMode } from '../Legend/Legend';

const GraphLegendStories = storiesOf('Visualizations/Graph/GraphLegend', module);
GraphLegendStories.addDecorator(withHorizontallyCenteredStory);

const getStoriesKnobs = (isList = false) => {
  const statsToDisplay = select(
    'Stats to display',
    {
      none: [],
      'single (min)': [{ text: '10ms', title: 'min', numeric: 10 }],
      'multiple (min, max)': [
        { text: '10ms', title: 'min', numeric: 10 },
        { text: '100ms', title: 'max', numeric: 100 },
      ],
    },
    []
  );

  const numberOfSeries = number('Number of series', 3);

  const containerWidth = select(
    'Container width',
    {
      Small: '200px',
      Medium: '500px',
      'Full width': '100%',
    },
    '100%'
  );

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
    numberOfSeries,
    containerWidth,
    legendPlacement,
  };
};

GraphLegendStories.add('list', () => {
  const { statsToDisplay, numberOfSeries, containerWidth, legendPlacement } = getStoriesKnobs(true);
  return (
    <div style={{ width: containerWidth }}>
      <GraphLegend
        displayMode={LegendDisplayMode.List}
        items={generateLegendItems(numberOfSeries, statsToDisplay)}
        onLabelClick={(item, event) => {
          action('Series label clicked')(item, event);
        }}
        onSeriesColorChange={(label, color) => {
          action('Series color changed')(label, color);
        }}
        onSeriesAxisToggle={(label, useRightYAxis) => {
          action('Series axis toggle')(label, useRightYAxis);
        }}
        onToggleSort={sortBy => {
          action('Toggle legend sort')(sortBy);
        }}
        placement={legendPlacement}
      />
    </div>
  );
});

GraphLegendStories.add('table', () => {
  const { statsToDisplay, numberOfSeries, containerWidth, legendPlacement } = getStoriesKnobs();
  return (
    <div style={{ width: containerWidth }}>
      <GraphLegend
        displayMode={LegendDisplayMode.Table}
        items={generateLegendItems(numberOfSeries, statsToDisplay)}
        onLabelClick={item => {
          action('Series label clicked')(item);
        }}
        onSeriesColorChange={(label, color) => {
          action('Series color changed')(label, color);
        }}
        onSeriesAxisToggle={(label, useRightYAxis) => {
          action('Series axis toggle')(label, useRightYAxis);
        }}
        onToggleSort={sortBy => {
          action('Toggle legend sort')(sortBy);
        }}
        placement={legendPlacement}
      />
    </div>
  );
});
