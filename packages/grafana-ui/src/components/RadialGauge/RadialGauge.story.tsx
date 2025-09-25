import { Meta, StoryFn } from '@storybook/react';

import { applyFieldOverrides, FieldType, toDataFrame } from '@grafana/data';
import { FieldColorModeId, GraphGradientMode } from '@grafana/schema';

import { useTheme2 } from '../../themes/ThemeContext';
import { Stack } from '../Layout/Stack/Stack';

import { RadialBar, RadialGauge, RadialGradientMode } from './RadialGauge';

const meta: Meta<typeof RadialBar> = {
  title: 'Plugins/RadialGauge',
  component: RadialBar,
  parameters: {
    controls: {},
  },
};

export const Examples: StoryFn<typeof RadialBar> = (args) => {
  return (
    <Stack direction={'column'} gap={3}>
      <RadialBarExample value={70} />
      <div>Gradient: Hue</div>
      <RadialBarExample value={70} gradientMode="hue" />
      <div>Gradient: Scheme, startAngle: 240° endAngle: 120°</div>
      <Stack direction="row" alignItems="center" gap={3}>
        <RadialBarExample
          colorMode={FieldColorModeId.ContinuousGrYlRd}
          gradientMode={GraphGradientMode.Scheme}
          value={40}
          startAngle={240}
          endAngle={120}
        />
        <RadialBarExample
          colorMode={FieldColorModeId.ContinuousGrYlRd}
          gradientMode={GraphGradientMode.Scheme}
          value={100}
          startAngle={240}
          endAngle={120}
        />
      </Stack>
    </Stack>
  );
};

interface ExampleProps {
  colorMode?: FieldColorModeId;
  gradientMode?: RadialGradientMode;
  color?: string;
  value?: number;
  startAngle?: number;
  endAngle?: number;
  min?: number;
  max?: number;
}

function RadialBarExample({
  colorMode = FieldColorModeId.Fixed,
  gradientMode = 'none',
  color = 'blue',
  value = 70,
  startAngle,
  endAngle,
  min = 0,
  max = 100,
}: ExampleProps) {
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
          min: min,
          max: max,
          unit: 'percent',
          color: { mode: colorMode, fixedColor: theme.visualization.getColorByName(color) },
        },
        // Add state and getLinks
        state: {},
        getLinks: () => [],
      },
    ],
  });

  const data = applyFieldOverrides({
    data: [frame],
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    replaceVariables: (value) => value,
    timeZone: 'utc',
    theme,
  });

  return (
    <RadialGauge
      frames={data}
      size={200}
      barWidth={17}
      gradientMode={gradientMode}
      startAngle={startAngle}
      endAngle={endAngle}
    />
  );
}

export default meta;
