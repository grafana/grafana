import React from 'react';
import { LegendList, LegendPlacement, LegendItem, LegendTable, generateLegendItems } from './Legend';
import { number, select, text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';
import { GraphLegendListItem, GraphLegendTableRow, GraphLegendItemProps } from '../Graph/GraphLegendItem';

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

  const rawRenderer = (item: LegendItem) => (
    <>
      Label: <strong>{item.label}</strong>, Color: <strong>{item.color}</strong>, isVisible:{' '}
      <strong>{item.isVisible ? 'yes' : 'no'}</strong>
    </>
  );

  const customRenderer = (component: React.ComponentType<GraphLegendItemProps>) => (item: LegendItem) =>
    React.createElement(component, {
      item,
      onLabelClick: action('GraphLegendItem label clicked'),
      onSeriesColorChange: action('Series color changed'),
      onToggleAxis: action('Y-axis toggle'),
    });

  const typeSpecificRenderer = table
    ? {
        'Custom renderer(GraphLegendTablerow)': 'custom-tabe',
      }
    : {
        'Custom renderer(GraphLegendListItem)': 'custom-list',
      };
  const legendItemRenderer = select(
    'Item rendered',
    {
      'Raw renderer': 'raw',
      ...typeSpecificRenderer,
    },
    'raw'
  );

  const rightAxisSeries = text('Right y-axis series, i.e. A,C', '');

  const legendPlacement = select<LegendPlacement>(
    'Legend placement',
    {
      under: 'under',
      right: 'right',
    },
    'under'
  );

  return {
    numberOfSeries,
    containerWidth,
    itemRenderer:
      legendItemRenderer === 'raw'
        ? rawRenderer
        : customRenderer(legendItemRenderer === 'custom-list' ? GraphLegendListItem : GraphLegendTableRow),
    rightAxisSeries,
    legendPlacement,
  };
};

export default {
  title: 'Visualizations/Legend',
  component: LegendList,
  subcomponents: { LegendTable },
};

export const list = () => {
  const { numberOfSeries, itemRenderer, containerWidth, rightAxisSeries, legendPlacement } = getStoriesKnobs();
  let items = generateLegendItems(numberOfSeries);

  items = items.map(i => {
    if (
      rightAxisSeries
        .split(',')
        .map(s => s.trim())
        .indexOf(i.label.split('-')[0]) > -1
    ) {
      i.yAxis = 2;
    }

    return i;
  });
  return (
    <div style={{ width: containerWidth }}>
      <LegendList itemRenderer={itemRenderer} items={items} placement={legendPlacement} />
    </div>
  );
};

export const table = () => {
  const { numberOfSeries, itemRenderer, containerWidth, rightAxisSeries, legendPlacement } = getStoriesKnobs(true);
  let items = generateLegendItems(numberOfSeries);

  items = items.map(i => {
    if (
      rightAxisSeries
        .split(',')
        .map(s => s.trim())
        .indexOf(i.label.split('-')[0]) > -1
    ) {
      i.yAxis = 2;
    }

    return {
      ...i,
      info: [
        { title: 'min', text: '14.42', numeric: 14.427101844163694 },
        { title: 'max', text: '18.42', numeric: 18.427101844163694 },
      ],
    };
  });
  return (
    <div style={{ width: containerWidth }}>
      <LegendTable itemRenderer={itemRenderer} items={items} columns={['', 'min', 'max']} placement={legendPlacement} />
    </div>
  );
};
