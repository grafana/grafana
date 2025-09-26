import { Meta, StoryFn } from '@storybook/react';

import { applyFieldOverrides, FieldType, toDataFrame } from '@grafana/data';
import { FieldColorModeId, GraphGradientMode } from '@grafana/schema';

import { useTheme2 } from '../../themes/ThemeContext';
import { Stack } from '../Layout/Stack/Stack';

import { RadialGauge, RadialGaugeProps, RadialGradientMode } from './RadialGauge';

interface StoryProps extends RadialGaugeProps {
  value: number;
}

const meta: Meta<StoryProps> = {
  title: 'Plugins/RadialGauge',
  component: RadialGauge,
  parameters: {
    controls: {
      exclude: ['theme', 'startAngle', 'endAngle', 'clockwise', 'gradientMode', 'frames'],
    },
  },
  args: {
    barWidth: 20,
    size: 200,
    spotlight: false,
    glow: false,
    centerGlow: false,
    sparkline: false,
    value: undefined,
  },
  argTypes: {
    barWidth: { control: { type: 'range', min: 5, max: 100 } },
    size: { control: { type: 'range', min: 50, max: 400 } },
    value: { control: { type: 'range', min: 0, max: 100 } },
    spotlight: { control: 'boolean' },
    sparkline: { control: 'boolean' },
  },
};

export const Basic: StoryFn<StoryProps> = (args) => {
  return (
    <Stack direction={'column'} gap={3}>
      <RadialBarExample {...args} />
    </Stack>
  );
};

Basic.args = {
  value: 70,
  size: 400,
};

export const Effects: StoryFn = (args) => {
  return (
    <Stack direction={'column'} gap={3}>
      <div>Spotlight</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample value={70} gradientMode="hue" {...args} spotlight />
        <RadialBarExample seriesName="Clockwise" gradientMode="hue" value={70} clockwise {...args} spotlight />
        <RadialBarExample gradientMode="hue" value={70} {...args} spotlight color="green" />
        <RadialBarExample gradientMode="hue" value={70} {...args} spotlight color="red" />
      </Stack>
      <div>Spotlight + Glow</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample value={70} gradientMode="hue" {...args} spotlight glow />
        <RadialBarExample seriesName="Clockwise" gradientMode="hue" value={70} clockwise {...args} spotlight glow />
        <RadialBarExample gradientMode="hue" value={70} {...args} spotlight color="green" glow />
        <RadialBarExample gradientMode="hue" value={70} {...args} spotlight color="red" glow />
      </Stack>
      <div>Spotlight + Glow + centerGlow</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample value={70} gradientMode="hue" {...args} spotlight glow centerGlow />
        <RadialBarExample
          seriesName="Clockwise"
          gradientMode="hue"
          value={70}
          clockwise
          {...args}
          spotlight
          glow
          centerGlow
        />
        <RadialBarExample gradientMode="hue" value={70} {...args} spotlight color="green" glow centerGlow />
        <RadialBarExample gradientMode="hue" value={70} {...args} spotlight color="red" glow centerGlow />
      </Stack>
    </Stack>
  );
};

export const Examples: StoryFn = (args) => {
  return (
    <Stack direction={'column'} gap={3} wrap="wrap">
      <Stack direction="row" alignItems="center" gap={3}>
        <RadialBarExample value={70} barWidth={args.barWidth} />
        <RadialBarExample value={70} seriesName="Clockwise" clockwise {...args} />
      </Stack>
      <div>Gradient: Hue</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample value={30} gradientMode="hue" color="blue" {...args} />
        <RadialBarExample value={50} gradientMode="hue" color="green" {...args} />
        <RadialBarExample value={60} gradientMode="hue" color="red" {...args} />
        <RadialBarExample value={90} gradientMode="hue" color="purple" {...args} />
      </Stack>
      <div>Gradient: Shade</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample value={30} gradientMode="shade" color="blue" {...args} />
        <RadialBarExample value={40} gradientMode="shade" color="green" {...args} />
        <RadialBarExample value={60} gradientMode="shade" color="red" {...args} />
        <RadialBarExample value={70} gradientMode="shade" color="purple" {...args} />
      </Stack>
      <div>Gradient: Scheme, startAngle: 240° endAngle: 120°</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample
          colorMode={FieldColorModeId.ContinuousGrYlRd}
          gradientMode={GraphGradientMode.Scheme}
          value={40}
          startAngle={240}
          endAngle={120}
          clockwise
          {...args}
        />
        <RadialBarExample
          colorMode={FieldColorModeId.ContinuousGrYlRd}
          gradientMode={GraphGradientMode.Scheme}
          value={100}
          startAngle={240}
          endAngle={120}
          clockwise
          {...args}
        />
      </Stack>
    </Stack>
  );
};

export const Sparklines: StoryFn<typeof RadialGauge> = (args) => {
  return (
    <Stack direction={'row'} gap={3}>
      <RadialBarExample
        value={70}
        size={300}
        gradientMode="hue"
        color="blue"
        clockwise
        startAngle={240}
        endAngle={120}
        {...args}
        sparkline={true}
      />
      <RadialBarExample
        value={30}
        size={300}
        gradientMode="hue"
        color="green"
        clockwise
        startAngle={240}
        endAngle={120}
        {...args}
        sparkline={true}
      />
      <RadialBarExample
        value={50}
        size={300}
        gradientMode="hue"
        color="red"
        clockwise
        startAngle={240}
        endAngle={120}
        {...args}
        sparkline={true}
      />
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
  glow?: boolean;
  centerGlow?: boolean;
  barWidth?: number;
  sparkline?: boolean;
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
  glow = false,
  centerGlow = false,
  barWidth = 20,
  sparkline = false,
}: ExampleProps) {
  const theme = useTheme2();

  const frame = toDataFrame({
    name: 'TestData',
    length: 18,
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
        config: {
          min: 0,
          max: 4,
        },
      },
      {
        name: seriesName,
        type: FieldType.number,
        values: [40, 45, 20, 25, 30, 28, 27, 30, 31, 26, 50, 55, 52, 20, 25, 30, 60, value],
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
      barWidth={barWidth}
      gradientMode={gradientMode}
      startAngle={startAngle}
      endAngle={endAngle}
      clockwise={clockwise}
      spotlight={spotlight}
      glow={glow}
      centerGlow={centerGlow}
      sparkline={sparkline}
    />
  );
}

export default meta;
