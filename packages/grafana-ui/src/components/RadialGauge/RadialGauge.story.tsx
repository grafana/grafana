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

export const Basic: StoryFn<typeof RadialBar> = (args) => {
  return (
    <Stack direction={'column'} gap={3}>
      <RadialBarExample value={70} size={500} clockwise />
    </Stack>
  );
};

export const Effects: StoryFn<typeof RadialBar> = (args) => {
  return (
    <Stack direction={'column'} gap={3}>
      <div>Spotlight</div>
      <Stack direction="row" alignItems="center" gap={3}>
        <RadialBarExample value={70} spotlight />
        <RadialBarExample seriesName="Clockwise" value={70} clockwise spotlight />
      </Stack>
    </Stack>
  );
};

export const Examples: StoryFn<typeof RadialBar> = (args) => {
  return (
    <Stack direction={'column'} gap={3}>
      <Stack direction="row" alignItems="center" gap={3}>
        <RadialBarExample value={70} />
        <RadialBarExample value={70} seriesName="Clockwise" clockwise />
      </Stack>
      <div>Gradient: Hue</div>
      <Stack direction="row" alignItems="center" gap={3}>
        <RadialBarExample value={30} gradientMode="hue" color="blue" />
        <RadialBarExample value={50} gradientMode="hue" color="green" />
        <RadialBarExample value={60} gradientMode="hue" color="red" />
        <RadialBarExample value={90} gradientMode="hue" color="purple" />
      </Stack>
      <div>Gradient: Shade</div>
      <Stack direction="row" alignItems="center" gap={3}>
        <RadialBarExample value={30} gradientMode="shade" color="blue" />
        <RadialBarExample value={40} gradientMode="shade" color="green" />
        <RadialBarExample value={60} gradientMode="shade" color="red" />
        <RadialBarExample value={70} gradientMode="shade" color="purple" />
      </Stack>
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
      <div>Gradient: Radial</div>
      <RadialBarExample value={70} gradientMode="radial" color="purple" />
    </Stack>
  );
};

interface ExampleProps {
  colorMode?: FieldColorModeId;
  gradientMode?: RadialGradientMode;
  color?: string;
  seriesName?: string;
  value?: number;
  startAngle?: number;
  endAngle?: number;
  min?: number;
  max?: number;
  clockwise?: boolean;
  size?: number;
  spotlight?: boolean;
}

function RadialBarExample({
  colorMode = FieldColorModeId.Fixed,
  gradientMode = 'none',
  color = 'blue',
  seriesName = 'Server A',
  value = 70,
  startAngle,
  endAngle,
  min = 0,
  max = 100,
  clockwise = false,
  size = 200,
  spotlight = false,
}: ExampleProps) {
  const theme = useTheme2();

  const frame = toDataFrame({
    name: 'TestData',
    length: 1,
    fields: [
      {
        name: seriesName,
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
      size={size}
      barWidth={17}
      gradientMode={gradientMode}
      startAngle={startAngle}
      endAngle={endAngle}
      clockwise={clockwise}
      spotlight={spotlight}
    />
  );
}

export default meta;
