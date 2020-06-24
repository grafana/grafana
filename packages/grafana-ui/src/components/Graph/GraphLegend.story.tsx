import React from 'react';
import { GraphLegend } from './GraphLegend';
import { action } from '@storybook/addon-actions';
import { select, number } from '@storybook/addon-knobs';
import { withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { generateLegendItems } from '../Legend/Legend';
import { LegendPlacement, LegendDisplayMode } from '../Legend/Legend';

export default {
  title: 'Visualizations/Graph/GraphLegend',
  component: GraphLegend,
  decorators: [withHorizontallyCenteredStory],
};

const getStoriesKnobs = (isList = false) => {
  const statsToDisplay = select<any>(
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

export const list = () => {
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
};

export const table = () => {
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
};
