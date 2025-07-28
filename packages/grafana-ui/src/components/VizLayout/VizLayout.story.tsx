import { Meta, StoryFn } from '@storybook/react';
import { useEffect, useState } from 'react';

import { VizLayout } from './VizLayout';

const meta: Meta = {
  title: 'Plugins/VizLayout',
  component: VizLayout,
  parameters: {
    docs: {},
    controls: {
      exclude: ['legend'],
    },
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
  },
  argTypes: {
    width: { control: { type: 'range', min: 100, max: 1000 } },
    height: { control: { type: 'range', min: 100, max: 1000 } },
    legendWidth: { control: { type: 'range', min: 100, max: 280 } },
    legendItems: { control: { type: 'number', min: 1 } },
  },
};

const createArray = (legendItems: number) => {
  const newArray = Array.from({ length: legendItems }, (_, i) => i + 1);
  return newArray;
};

export const BottomLegend: StoryFn = ({ height, width, legendItems }) => {
  const [items, setItems] = useState(createArray(legendItems));
  useEffect(() => {
    setItems(createArray(legendItems));
  }, [legendItems]);

  const legend = (
    <VizLayout.Legend placement="bottom" maxHeight="30%">
      {items.map((_, index) => (
        <div style={{ height: '30px', width: '100%', background: 'blue', marginBottom: '2px' }} key={index}>
          Legend item {index}
        </div>
      ))}
    </VizLayout.Legend>
  );

  return (
    <VizLayout width={width} height={height} legend={legend}>
      {(vizWidth: number, vizHeight: number) => {
        return <div style={{ width: vizWidth, height: vizHeight, background: 'red' }} />;
      }}
    </VizLayout>
  );
};
BottomLegend.args = {
  height: 600,
  width: 500,
  legendItems: 2,
};

export const RightLegend: StoryFn = ({ height, width, legendItems, legendWidth }) => {
  const [items, setItems] = useState(createArray(legendItems));
  useEffect(() => {
    setItems(createArray(legendItems));
  }, [legendItems]);

  const legend = (
    <VizLayout.Legend placement="right" maxWidth="50%">
      {items.map((_, index) => (
        <div style={{ height: '30px', width: `${legendWidth}px`, background: 'blue', marginBottom: '2px' }} key={index}>
          Legend item {index}
        </div>
      ))}
    </VizLayout.Legend>
  );

  return (
    <VizLayout width={width} height={height} legend={legend}>
      {(vizWidth: number, vizHeight: number) => {
        return <div style={{ width: vizWidth, height: vizHeight, background: 'red' }} />;
      }}
    </VizLayout>
  );
};
RightLegend.args = {
  height: 400,
  width: 810,
  legendWidth: 100,
  legendItems: 2,
};

export default meta;
