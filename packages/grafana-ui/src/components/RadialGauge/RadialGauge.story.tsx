import { Meta, StoryFn } from '@storybook/react';

import { applyFieldOverrides, FieldType, toDataFrame } from '@grafana/data';
import { FieldColorModeId, GraphGradientMode } from '@grafana/schema';

import { useTheme2 } from '../../themes/ThemeContext';
import { StoryExample } from '../../utils/storybook/StoryExample';
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
  return (
    <Stack direction={'column'}>
      <RadialBarExample title="value: 70" value={70} />
      <Stack>
        <RadialBarExample
          title="value: 40%, gradient: Scheme, 240° -> 120°"
          colorMode={FieldColorModeId.ContinuousGrYlRd}
          gradientMode={GraphGradientMode.Scheme}
          value={40}
          startAngle={240}
          endAngle={120}
        />
        <RadialBarExample
          title="value: 100, gradient: Scheme"
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
  title: string;
  colorMode?: FieldColorModeId;
  gradientMode?: GraphGradientMode;
  color?: string;
  value?: number;
  startAngle?: number;
  endAngle?: number;
  min?: number;
  max?: number;
}

function RadialBarExample({
  title,
  colorMode = FieldColorModeId.Fixed,
  gradientMode = GraphGradientMode.None,
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
    <StoryExample name={title}>
      <RadialGauge
        frames={data}
        size={200}
        barWidth={17}
        gradientMode={gradientMode}
        startAngle={startAngle}
        endAngle={endAngle}
      />
    </StoryExample>
  );
}

export default meta;
