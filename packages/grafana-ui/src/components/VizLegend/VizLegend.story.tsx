import { getColorForTheme, VizOrientation } from '@grafana/data';
import React, { FC } from 'react';
import { useTheme } from '../../themes';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { VizLegend, VizLegendItem } from './VizLegend';

export default {
  title: 'Visualizations/VizLegend',
  component: VizLegend,
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

export const Simple: FC<any> = () => {
  const theme = useTheme();

  return (
    <div>
      <p>Horizontal</p>
      <VizLegend orientation={VizOrientation.Horizontal}>
        <VizLegendItem color={getColorForTheme('blue', theme)} name="Europe" />
        <VizLegendItem color={getColorForTheme('green', theme)} name="USA" />
        <VizLegendItem color={getColorForTheme('red', theme)} name="South America" />
      </VizLegend>
      <br />
      <p>Vertical</p>
      <VizLegend orientation={VizOrientation.Vertical}>
        <VizLegendItem color={getColorForTheme('red', theme)} name="Europe" />
        <VizLegendItem color={getColorForTheme('green', theme)} name="USA" />
        <VizLegendItem color={getColorForTheme('blue', theme)} name="South America" />
      </VizLegend>
    </div>
  );
};
