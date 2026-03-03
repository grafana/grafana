import { StoryFn, Meta } from '@storybook/react';
import { FC, useEffect, useState } from 'react';

import { DisplayValue, GrafanaTheme2 } from '@grafana/data';
import { LegendDisplayMode, LegendPlacement, SortOrder } from '@grafana/schema';

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
  sortOrder?: SortOrder;
}

const LegendStoryDemo: FC<LegendStoryDemoProps> = ({ displayMode, seriesCount, name, placement, stats, sortOrder }) => {
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
      <VizLegend
        displayMode={displayMode}
        items={items}
        placement={placement}
        onLabelClick={onLabelClick}
        sortOrder={sortOrder}
      />
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

function generateMixedCaseLegendItems(theme: GrafanaTheme2, statsToDisplay?: DisplayValue[]): VizLegendItem[] {
  const labels = ['Zebra', 'apple', 'Mango', 'banana', 'Cherry', 'date'];
  const colors = ['green', 'blue', 'red', 'purple', 'orange', 'dark-green'].map((c) =>
    theme.visualization.getColorByName(c)
  );

  return labels.map((label, i) => ({
    label,
    color: colors[i],
    yAxis: 1,
    displayValues: statsToDisplay || [],
  }));
}

function generateNumericLegendItems(theme: GrafanaTheme2, statsToDisplay?: DisplayValue[]): VizLegendItem[] {
  const labels = ['series-10', 'series-2', 'series-1', 'series-20', 'series-3', 'series-100'];
  const colors = ['green', 'blue', 'red', 'purple', 'orange', 'dark-green'].map((c) =>
    theme.visualization.getColorByName(c)
  );

  return labels.map((label, i) => ({
    label,
    color: colors[i],
    yAxis: 1,
    displayValues: statsToDisplay || [],
  }));
}

export const WithSortingNone: StoryFn = () => {
  const theme = useTheme2();
  const [items] = useState<VizLegendItem[]>(generateMixedCaseLegendItems(theme));

  return (
    <div style={{ width: '100%' }}>
      <p style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px' }}>List mode with sortOrder: None (default order)</h3>
        <p style={{ marginBottom: '16px', color: '#888' }}>
          Legend items displayed in original order: Zebra, apple, Mango, banana, Cherry, date
        </p>
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={items}
          placement="bottom"
          sortOrder={SortOrder.None}
        />
      </p>
    </div>
  );
};

export const WithSortingAscending: StoryFn = () => {
  const theme = useTheme2();
  const [items] = useState<VizLegendItem[]>(generateMixedCaseLegendItems(theme));

  return (
    <div style={{ width: '100%' }}>
      <p style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px' }}>List mode with sortOrder: Ascending (A-Z)</h3>
        <p style={{ marginBottom: '16px', color: '#888' }}>
          Legend items sorted alphabetically: apple, banana, Cherry, date, Mango, Zebra
        </p>
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={items}
          placement="bottom"
          sortOrder={SortOrder.Ascending}
        />
      </p>
    </div>
  );
};

export const WithSortingDescending: StoryFn = () => {
  const theme = useTheme2();
  const [items] = useState<VizLegendItem[]>(generateMixedCaseLegendItems(theme));

  return (
    <div style={{ width: '100%' }}>
      <p style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px' }}>List mode with sortOrder: Descending (Z-A)</h3>
        <p style={{ marginBottom: '16px', color: '#888' }}>
          Legend items sorted reverse alphabetically: Zebra, Mango, date, Cherry, banana, apple
        </p>
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={items}
          placement="bottom"
          sortOrder={SortOrder.Descending}
        />
      </p>
    </div>
  );
};

export const WithMixedCaseSorting: StoryFn = () => {
  const theme = useTheme2();
  const [items] = useState<VizLegendItem[]>(generateMixedCaseLegendItems(theme));

  return (
    <div style={{ width: '100%' }}>
      <p style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px' }}>Sorting is case-insensitive</h3>
        <p style={{ marginBottom: '16px', color: '#888' }}>
          Original: Zebra, apple, Mango, banana, Cherry, date
        </p>
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={items}
          placement="bottom"
          sortOrder={SortOrder.None}
        />
      </p>
      <p style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px' }}>Sorted A-Z (case-insensitive)</h3>
        <p style={{ marginBottom: '16px', color: '#888' }}>
          Result: apple, banana, Cherry, date, Mango, Zebra
        </p>
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={items}
          placement="bottom"
          sortOrder={SortOrder.Ascending}
        />
      </p>
    </div>
  );
};

export const WithNumericSorting: StoryFn = () => {
  const theme = useTheme2();
  const [items] = useState<VizLegendItem[]>(generateNumericLegendItems(theme));

  return (
    <div style={{ width: '100%' }}>
      <p style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px' }}>Natural numeric ordering</h3>
        <p style={{ marginBottom: '16px', color: '#888' }}>
          Original order: series-10, series-2, series-1, series-20, series-3, series-100
        </p>
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={items}
          placement="bottom"
          sortOrder={SortOrder.None}
        />
      </p>
      <p style={{ marginBottom: '32px' }}>
        <h3 style={{ marginBottom: '16px' }}>Sorted with natural numeric comparison</h3>
        <p style={{ marginBottom: '16px', color: '#888' }}>
          Result: series-1, series-2, series-3, series-10, series-20, series-100 (not series-1, series-10, series-100, series-2, ...)
        </p>
        <VizLegend
          displayMode={LegendDisplayMode.List}
          items={items}
          placement="bottom"
          sortOrder={SortOrder.Ascending}
        />
      </p>
    </div>
  );
};

export default meta;
