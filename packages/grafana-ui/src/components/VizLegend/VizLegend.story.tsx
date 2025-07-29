import { StoryFn, Meta } from '@storybook/react';
import { FC, useEffect, useState } from 'react';

import { DisplayValue, GrafanaTheme2 } from '@grafana/data';
import { LegendDisplayMode, LegendPlacement } from '@grafana/schema';

import { useTheme2 } from '../../themes/ThemeContext';

import { VizLegend } from './VizLegend';
import { VizLegendItem } from './types';

const meta: Meta = {
  title: 'Plugins/VizLegend',
  component: VizLegend,
  args: {
    containerWidth: '100%',
    seriesCount: 5,
  },
  parameters: {
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
  },
  argTypes: {
    containerWidth: {
      control: {
        type: 'select',
        options: ['200px', '500px', '100%'],
      },
    },
    seriesCount: {
      control: {
        type: 'number',
        min: 1,
        max: 8,
      },
    },
  },
};

interface LegendStoryDemoProps {
  name: string;
  displayMode: LegendDisplayMode;
  placement: LegendPlacement;
  seriesCount: number;
  stats?: DisplayValue[];
}

const LegendStoryDemo: FC<LegendStoryDemoProps> = ({ displayMode, seriesCount, name, placement, stats }) => {
  const theme = useTheme2();
  const [items, setItems] = useState<VizLegendItem[]>(generateLegendItems(seriesCount, theme, stats));

  useEffect(() => {
    setItems(generateLegendItems(seriesCount, theme, stats));
  }, [seriesCount, theme, stats]);

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
      <VizLegend displayMode={displayMode} items={items} placement={placement} onLabelClick={onLabelClick} />
    </p>
  );
};

export const WithNoValues: StoryFn = ({ containerWidth, seriesCount }) => {
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

export const WithValues: StoryFn = ({ containerWidth, seriesCount }) => {
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
  theme: GrafanaTheme2,
  statsToDisplay?: DisplayValue[]
): VizLegendItem[] {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const colors = ['green', 'blue', 'red', 'purple', 'orange', 'dark-green', 'yellow', 'light-blue'].map((c) =>
    theme.visualization.getColorByName(c)
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

export default meta;
