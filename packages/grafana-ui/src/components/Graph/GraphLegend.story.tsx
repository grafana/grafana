import React from 'react';
import { storiesOf } from '@storybook/react';

import { GraphLegend } from './GraphLegend';
import { LegendList } from '../Legend/LegendList';
import { action } from '@storybook/addon-actions';
import { select, number } from '@storybook/addon-knobs';
import { withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { generateLegendItems } from '../Legend/Legend.story';

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
    ['min', 'max']
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
  return {
    statsToDisplay,
    numberOfSeries,
    containerWidth,
  };
};

GraphLegendStories.add('list', () => {
  const { statsToDisplay, numberOfSeries, containerWidth } = getStoriesKnobs();
  return (
    <div style={{ width: containerWidth }}>
      <GraphLegend
        items={generateLegendItems(numberOfSeries)}
        renderLegendAs={LegendList}
        onLabelClick={item => {
          action('Series label clicked')(item);
        }}
        onSeriesColorChange={color => {
          action('Series color changed')(color);
        }}
        onToggleAxis={() => {
          action('Series axis toggle')();
        }}
        statsToDisplay={statsToDisplay}
      />
    </div>
  );
});

GraphLegendStories.add('table', () => {
  const { statsToDisplay, numberOfSeries, containerWidth } = getStoriesKnobs();
  return (
    <div style={{ width: containerWidth }}>
      <GraphLegend
        items={generateLegendItems(numberOfSeries)}
        renderLegendAs={LegendList}
        onLabelClick={item => {
          action('Series label clicked')(item);
        }}
        onSeriesColorChange={color => {
          action('Series color changed')(color);
        }}
        onToggleAxis={() => {
          action('Series axis toggle')();
        }}
        statsToDisplay={statsToDisplay}
      />
    </div>
  );
});
