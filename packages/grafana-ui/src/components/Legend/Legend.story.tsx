import React from 'react';
import { VizLegend } from '@grafana/ui';
import { number, select } from '@storybook/addon-knobs';
import {} from './LegendListItem';
import tinycolor from 'tinycolor2';
import { DisplayValue } from '@grafana/data';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { LegendDisplayMode, LegendItem } from './types';

const getStoriesKnobs = (table = false) => {
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
    numberOfSeries,
    containerWidth,
  };
};

export default {
  title: 'Visualizations/VizLegend',
  component: VizLegend,
  decorators: [withCenteredStory],
};

export const Examples = () => {
  const { numberOfSeries, containerWidth } = getStoriesKnobs();
  let items = generateLegendItems(numberOfSeries);

  return (
    <div style={{ width: containerWidth }}>
      <p>
        List placement bottom
        <VizLegend displayMode={LegendDisplayMode.List} items={items} placement="bottom" />
      </p>
      <p>
        List placement right
        <VizLegend displayMode={LegendDisplayMode.List} items={items} placement="right" />
      </p>
      <p>
        Display mode table
        <VizLegend displayMode={LegendDisplayMode.Table} items={items} placement="bottom" />
      </p>
    </div>
  );
};

function generateLegendItems(numberOfSeries: number, statsToDisplay?: DisplayValue[]): LegendItem[] {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

  return [...new Array(numberOfSeries)].map((item, i) => {
    return {
      label: `${alphabet[i].toUpperCase()}-series`,
      color: tinycolor.fromRatio({ h: i / alphabet.length, s: 1, v: 1 }).toHexString(),
      yAxis: 1,
      displayValues: statsToDisplay || [],
    };
  });
}
