import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { number } from '@storybook/addon-knobs';
import { VizLayout } from './VizLayout';

export default {
  title: 'Visualizations/VizLayout',
  component: VizLayout,
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

const getKnobs = () => {
  return {
    legendWidth: number('legendWidth', 100),
    legendItems: number('legendItems', 2),
  };
};

export const BottomLegend = () => {
  const { legendItems } = getKnobs();
  const items = Array.from({ length: legendItems }, (_, i) => i + 1);

  const legend = (
    <VizLayout.Legend position="bottom" maxHeight="30%">
      {items.map((_, index) => (
        <div style={{ height: '30px', width: '100%', background: 'blue', marginBottom: '2px' }} key={index}>
          Legend item {index}
        </div>
      ))}
    </VizLayout.Legend>
  );

  return (
    <VizLayout width={600} height={500} legend={legend}>
      {(vizWidth: number, vizHeight: number) => {
        return <div style={{ width: vizWidth, height: vizHeight, background: 'red' }} />;
      }}
    </VizLayout>
  );
};

export const RightLegend = () => {
  const { legendItems, legendWidth } = getKnobs();
  const items = Array.from({ length: legendItems }, (_, i) => i + 1);

  const legend = (
    <VizLayout.Legend position="right" maxWidth="50%">
      {items.map((_, index) => (
        <div style={{ height: '30px', width: `${legendWidth}px`, background: 'blue', marginBottom: '2px' }} key={index}>
          Legend item {index}
        </div>
      ))}
    </VizLayout.Legend>
  );

  return (
    <VizLayout width={810} height={400} legend={legend}>
      {(vizWidth: number, vizHeight: number) => {
        return <div style={{ width: vizWidth, height: vizHeight, background: 'red' }} />;
      }}
    </VizLayout>
  );
};
