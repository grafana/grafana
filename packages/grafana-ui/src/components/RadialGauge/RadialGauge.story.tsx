import { Meta, StoryFn } from '@storybook/react';

import { applyFieldOverrides, DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { FieldColorModeId, GraphGradientMode } from '@grafana/schema';

import { useTheme2 } from '../../themes/ThemeContext';
import { Stack } from '../Layout/Stack/Stack';

import { RadialBar, RadialGauge } from './RadialGauge';

const meta: Meta<typeof RadialBar> = {
  title: 'Plugins/RadialGauge',
  component: RadialBar,
  parameters: {
    controls: {},
  },
};

export const Examples: StoryFn<typeof RadialBar> = (args) => {
  const data1 = useRadialData({ value: 70 });
  const data2 = useRadialData({ value: 50, colorMode: FieldColorModeId.ContinuousGrYlRd });

  return (
    <Stack direction={'column'}>
      <div>startAngle = 0, endAngle = 360, value: 70 (min: 0, max: 100)</div>
      <RadialGauge frames={data1} size={250} barWidth={17} />
      <div>startAngle = 240, endAngle = 120</div>
      <RadialGauge
        frames={data2}
        size={250}
        barWidth={17}
        gradientMode={GraphGradientMode.Scheme}
        startAngle={240}
        endAngle={120}
      />
    </Stack>
  );
};

interface DataOptions {
  colorMode?: FieldColorModeId;
  color?: string;
  value?: number;
}

function useRadialData({ colorMode = FieldColorModeId.Fixed, color = 'blue', value = 70 }: DataOptions): DataFrame[] {
  const theme = useTheme2();

  const frame = toDataFrame({
    name: 'TestData',
    length: 1,
    fields: [
      {
        name: 'Server A',
        type: FieldType.number,
        values: [value],
        config: {
          min: 0,
          max: 100,
          color: { mode: colorMode, fixedColor: theme.visualization.getColorByName(color) },
        },
        // Add state and getLinks
        state: {},
        getLinks: () => [],
      },
      // {
      //   name: 'Column B',
      //   type: FieldType.number,
      //   values: [1, 2, 3],
      //   config: {
      //     custom: {},
      //   },
      //   // Add state and getLinks
      //   state: {},
      //   getLinks: () => [],
      // },
    ],
  });

  return applyFieldOverrides({
    data: [frame],
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    replaceVariables: (value) => value,
    timeZone: 'utc',
    theme,
  });
}

export default meta;
