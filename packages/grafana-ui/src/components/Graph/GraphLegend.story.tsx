import React from 'react';
import { storiesOf } from '@storybook/react';

import { GraphLegend } from './GraphLegend';
import { LegendList } from '../Legend/LegendList';
import { action } from '@storybook/addon-actions';
import { select, number } from '@storybook/addon-knobs';
import { withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { generateLegendItems } from '../Legend/Legend.story';
import { LegendPlacement } from '../Legend/Legend';

const GraphLegendStories = storiesOf('UI/Graph/GraphLegend', module);
GraphLegendStories.addDecorator(withHorizontallyCenteredStory);

const getStoriesKnobs = () => {
  const statsToDisplay = select(
    'Stats to display',
    {
      none: [],
      'single (min)': ['min'],
      'multiple (min, max)': ['min', 'max'],
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
  const { statsToDisplay, numberOfSeries, containerWidth, legendPlacement } = getStoriesKnobs();
  return (
    <div style={{ width: containerWidth }}>
      <GraphLegend
        items={generateLegendItems(numberOfSeries)}
        renderLegendAs={LegendList}
        onLabelClick={(item, event) => {
          action('Series label clicked')(item, event);
        }}
        onSeriesColorChange={(label, color) => {
          action('Series color changed')(label, color);
        }}
        onSeriesAxisToggle={(label, useRightYAxis) => {
          action('Series axis toggle')(label, useRightYAxis);
        }}
        statsToDisplay={statsToDisplay}
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
        items={generateLegendItems(numberOfSeries)}
        renderLegendAs={LegendList}
        onLabelClick={item => {
          action('Series label clicked')(item);
        }}
        onSeriesColorChange={(label, color) => {
          action('Series color changed')(label, color);
        }}
        onSeriesAxisToggle={(label, useRightYAxis) => {
          action('Series axis toggle')(label, useRightYAxis);
        }}
        statsToDisplay={statsToDisplay}
        placement={legendPlacement}
      />
    </div>
  );
});
