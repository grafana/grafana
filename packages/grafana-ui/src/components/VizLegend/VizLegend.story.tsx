import React, { FC, useState } from 'react';
import { useTheme, VizLegend } from '@grafana/ui';
import { number, select } from '@storybook/addon-knobs';
import {} from './VizLegendListItem';
import { DisplayValue, getColorForTheme, GrafanaTheme } from '@grafana/data';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { LegendDisplayMode, VizLegendItem, LegendPlacement } from './types';

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
  stats?: DisplayValue[];
}

const LegendStoryDemo: FC<LegendStoryDemoProps> = ({ displayMode, seriesCount, name, placement, stats }) => {
  const theme = useTheme();
  const [items, setItems] = useState<VizLegendItem[]>(generateLegendItems(seriesCount, theme, stats));

  const onSeriesColorChange = (label: string, color: string) => {
    setItems(
      items.map((item) => {
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

  const onLabelClick = (clickItem: VizLegendItem) => {
    setItems(
      items.map((item) => {
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

export const WithValues = () => {
  const { seriesCount, containerWidth } = getStoriesKnobs();
  const stats: DisplayValue[] = [
    {
      title: 'Min',
      text: '5.00',
      numeric: 5,
    },
    {
      title: 'Max',
      text: '10.00',
      numeric: 10,
    },
    {
      title: 'Last',
      text: '2.00',
      numeric: 2,
    },
  ];

  return (
    <div style={{ width: containerWidth }}>
      <LegendStoryDemo
        name="List mode, placement bottom"
        displayMode={LegendDisplayMode.List}
        seriesCount={seriesCount}
        placement="bottom"
        stats={stats}
      />
      <LegendStoryDemo
        name="List mode, placement right"
        displayMode={LegendDisplayMode.List}
        seriesCount={seriesCount}
        placement="right"
        stats={stats}
      />
      <LegendStoryDemo
        name="Table mode"
        displayMode={LegendDisplayMode.Table}
        seriesCount={seriesCount}
        placement="bottom"
        stats={stats}
      />
    </div>
  );
};

function generateLegendItems(
  numberOfSeries: number,
  theme: GrafanaTheme,
  statsToDisplay?: DisplayValue[]
): VizLegendItem[] {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const colors = ['green', 'blue', 'red', 'purple', 'orange', 'dark-green', 'yellow', 'light-blue'].map((c) =>
    getColorForTheme(c, theme)
  );

  return [...new Array(numberOfSeries)].map((item, i) => {
    return {
      label: `${alphabet[i].toUpperCase()}-series`,
      color: colors[i],
      yAxis: 1,
      displayValues: statsToDisplay || [],
    };
  });
}
