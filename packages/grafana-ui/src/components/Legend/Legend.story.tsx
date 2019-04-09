import React from 'react';
import { storiesOf } from '@storybook/react';
import { Legend, LegendItem } from './Legend';
import { LegendList } from './LegendList';
import tinycolor from 'tinycolor2';
import { number, select } from '@storybook/addon-knobs';
import { GraphLegendItem } from '../Graph/GraphLegendItem';

export const generateLegendItems = (numberOfSeries: number) => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

  return [...new Array(numberOfSeries)].map((item, i) => {
    console.log(i);
    return {
      label: `${alphabet[i].toUpperCase()}-series`,
      color: tinycolor.fromRatio({ h: i / alphabet.length, s: 1, v: 1 }).toHexString(),
      isVisible: true,
      stats: [{ statId: 'min', value: 2 }, { statId: 'max', value: 10 }],
    };
  });
};

const getStoriesKnobs = () => {
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

  const rawRenderer = (item: LegendItem) => (
    <>
      Label: <strong>{item.label}</strong>, Color: <strong>{item.color}</strong>, isVisible:{' '}
      <strong>{item.isVisible ? 'yes' : 'no'}</strong>
    </>
  );

  const customRenderer = (item: LegendItem) => (
    <GraphLegendItem item={item} onLabelClick={() => {}} onSeriesColorChange={() => {}} onToggleAxis={() => {}} />
  );

  const legendItemRenderer = select(
    'Item rendered',
    {
      'Raw renderer': 'raw',
      'Custom renderer(GraphLegenditem)': 'custom',
    },
    'raw'
  );

  return {
    numberOfSeries,
    containerWidth,
    itemRenderer: legendItemRenderer === 'raw' ? rawRenderer : customRenderer,
  };
};

const LegendStories = storiesOf('UI/Legend/Legend', module);

LegendStories.add('list', () => {
  const { numberOfSeries, itemRenderer, containerWidth } = getStoriesKnobs();
  return (
    <div style={{ width: containerWidth }}>
      <Legend itemRenderer={itemRenderer} renderLegendAs={LegendList} items={generateLegendItems(numberOfSeries)} />
    </div>
  );
});

LegendStories.add('table', () => {
  return <h1>TODO</h1>;
});
