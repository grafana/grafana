import React, { FC, useState } from 'react';
import { VizLegend } from '@grafana/ui';
import { number, select } from '@storybook/addon-knobs';
import {} from './LegendListItem';
import tinycolor from 'tinycolor2';
import { DisplayValue } from '@grafana/data';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { LegendDisplayMode, LegendItem, LegendPlacement } from './types';

const getStoriesKnobs = (table = false) => {
  const seriesCount = number('Number of series', 5);
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
    seriesCount,
    containerWidth,
  };
};

export default {
  title: 'Visualizations/VizLegend',
  component: VizLegend,
  decorators: [withCenteredStory],
};

interface LegendStoryDemoProps {
  name: string;
  displayMode: LegendDisplayMode;
  placement: LegendPlacement;
  seriesCount: number;
}

const LegendStoryDemo: FC<LegendStoryDemoProps> = ({ displayMode, seriesCount, name, placement }) => {
  const [items, setItems] = useState<LegendItem[]>(generateLegendItems(seriesCount));

  const onSeriesColorChange = (label: string, color: string) => {
    setItems(
      items.map(item => {
        if (item.label === label) {
          return {
            ...item,
            color: color,
          };
        }

        return item;
      })
    );
  };

  const onLabelClick = (clickItem: LegendItem) => {
    setItems(
      items.map(item => {
        if (item !== clickItem) {
          return {
            ...item,
            disabled: true,
          };
        } else {
          return {
            ...item,
            disabled: false,
          };
        }
      })
    );
  };

  return (
    <p style={{ marginBottom: '32px' }}>
      <h3 style={{ marginBottom: '32px' }}>{name}</h3>
      <VizLegend
        displayMode={displayMode}
        items={items}
        placement={placement}
        onSeriesColorChange={onSeriesColorChange}
        onLabelClick={onLabelClick}
      />
    </p>
  );
};

export const WithNoValues = () => {
  const { seriesCount, containerWidth } = getStoriesKnobs();

  return (
    <div style={{ width: containerWidth }}>
      <LegendStoryDemo
        name="List mode, placement bottom"
        displayMode={LegendDisplayMode.List}
        seriesCount={seriesCount}
        placement="bottom"
      />
      <LegendStoryDemo
        name="List mode, placement right"
        displayMode={LegendDisplayMode.List}
        seriesCount={seriesCount}
        placement="right"
      />
      <LegendStoryDemo
        name="Table mode"
        displayMode={LegendDisplayMode.Table}
        seriesCount={seriesCount}
        placement="bottom"
      />
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
