import React from 'react';
import { storiesOf } from '@storybook/react';

import { select } from '@storybook/addon-knobs';
import { withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { GraphWithLegend } from './GraphWithLegend';

import { mockGraphWithLegendData } from './mockGraphWithLegendData';
import { StatID } from '../../utils/index';
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
  return {
    statsToDisplay,
    containerWidth,
    containerHeight,
  };
};

GraphWithLegendStories.add('default', () => {
  const { containerWidth, containerHeight, statsToDisplay } = getStoriesKnobs();
  return (
    <div style={{ width: containerWidth, height: containerHeight }}>
      <GraphWithLegend {...mockGraphWithLegendData({ stats: statsToDisplay })} />
    </div>
  );
});
