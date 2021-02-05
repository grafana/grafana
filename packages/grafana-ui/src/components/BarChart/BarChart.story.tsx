import { toDataFrame, FieldType, VizOrientation } from '@grafana/data';
import React from 'react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { BarChart } from './BarChart';
import { LegendDisplayMode } from '../VizLegend/types';
import { prepDataForStorybook } from '../../utils/storybook/data';
import { useTheme } from '../../themes';
import { select } from '@storybook/addon-knobs';
import { BarChartOptions, BarStackingMode, BarValueVisibility } from './types';

export default {
  title: 'Visualizations/BarChart',
  component: BarChart,
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

const getKnobs = () => {
  return {
    legendPlacement: select(
      'Legend placement',
      {
        bottom: 'bottom',
        right: 'right',
      },
      'bottom'
    ),
    orientation: select(
      'Bar orientation',
      {
        vertical: VizOrientation.Vertical,
        horizontal: VizOrientation.Horizontal,
      },
      VizOrientation.Vertical
    ),
  };
};

export const Basic: React.FC = () => {
  const { legendPlacement, orientation } = getKnobs();

  const theme = useTheme();
  const frame = toDataFrame({
    fields: [
      { name: 'x', type: FieldType.string, values: ['group 1', 'group 2'] },
      { name: 'a', type: FieldType.number, values: [10, 20] },
      { name: 'b', type: FieldType.number, values: [30, 10] },
    ],
  });

  const data = prepDataForStorybook([frame], theme);

  const options: BarChartOptions = {
    orientation: orientation,
    legend: { displayMode: LegendDisplayMode.List, placement: legendPlacement, calcs: [] },
    stacking: BarStackingMode.None,
    showValue: BarValueVisibility.Always,
    barWidth: 0.97,
    groupWidth: 0.7,
  };

  return <BarChart data={data[0]} width={600} height={400} theme={theme} {...options} />;
};
