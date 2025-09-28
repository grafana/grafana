import { Meta, StoryFn } from '@storybook/react';

import {
  applyFieldOverrides,
  Field,
  FieldType,
  getFieldDisplayValues,
  GrafanaTheme2,
  toDataFrame,
} from '@grafana/data';
import { FieldColorModeId, GraphGradientMode } from '@grafana/schema';

import { useTheme2 } from '../../themes/ThemeContext';
import { Stack } from '../Layout/Stack/Stack';

import { RadialGauge, RadialGaugeProps, RadialGradientMode, RadialTextMode } from './RadialGauge';

interface StoryProps extends RadialGaugeProps {
  value: number;
  seriesCount: number;
  sparkline: boolean;
  size: number;
}

const meta: Meta<StoryProps> = {
  title: 'Plugins/RadialGauge',
  component: RadialGauge,
  parameters: {
    controls: {
      exclude: ['theme', 'startAngle', 'endAngle', 'clockwise', 'frames'],
    },
  },
  args: {
    barWidthFactor: 0.2,
    size: 250,
    spotlight: false,
    glowBar: false,
    glowCenter: false,
    sparkline: false,
    value: undefined,
    clockwise: true,
    gradient: 'hue',
    seriesCount: 1,
    semicircle: false,
  },
  argTypes: {
    barWidthFactor: { control: { type: 'range', min: 0.1, max: 1, step: 0.01 } },
    size: { control: { type: 'range', min: 50, max: 400 } },
    value: { control: { type: 'range', min: 0, max: 110 } },
    spotlight: { control: 'boolean' },
    sparkline: { control: 'boolean' },
    semicircle: { control: 'boolean' },
    gradient: { control: { type: 'radio', options: ['none', 'hue', 'shade', 'scheme'] } },
    seriesCount: { control: { type: 'range', min: 1, max: 20 } },
  },
};

export const Basic: StoryFn<StoryProps> = (args) => {
  const visualizations: React.ReactNode[] = [];
  const colors = ['blue', 'green', 'red', 'purple', 'orange', 'yellow', 'dark-red', 'dark-blue', 'dark-green'];

  for (let i = 0; i < args.seriesCount; i++) {
    visualizations.push(
      <RadialBarExample
        {...args}
        key={i}
        color={colors[i % colors.length]}
        seriesCount={0}
        vizCount={args.seriesCount}
      />
    );
  }

  return (
    <Stack direction={'row'} gap={3} wrap="wrap">
      {visualizations}
    </Stack>
  );
};

export const Examples: StoryFn = (args) => {
  delete args.seriesCount;

  return (
    <Stack direction={'column'} gap={3} wrap="wrap">
      <div>Bar width</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample seriesName="5" value={60} gradient="hue" color="blue" barWidthFactor={5} />
        <RadialBarExample seriesName="10" value={60} gradient="hue" color="green" barWidthFactor={10} />
        <RadialBarExample seriesName="20" value={60} gradient="hue" color="red" barWidthFactor={20} />
        <RadialBarExample seriesName="30" value={60} gradient="hue" color="purple" barWidthFactor={30} />
      </Stack>

      <div>Gradient: Hue</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample value={30} gradient="hue" color="blue" barWidthFactor={args.barWidth} />
        <RadialBarExample value={50} gradient="hue" color="green" barWidthFactor={args.barWidth} />
        <RadialBarExample value={60} gradient="hue" color="red" barWidthFactor={args.barWidth} />
        <RadialBarExample value={90} gradient="hue" color="purple" barWidthFactor={args.barWidth} />
      </Stack>
      <div>Gradient: Shade</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample value={30} gradient="shade" color="blue" barWidthFactor={args.barWidth} />
        <RadialBarExample value={40} gradient="shade" color="green" barWidthFactor={args.barWidth} />
        <RadialBarExample value={60} gradient="shade" color="red" barWidthFactor={args.barWidth} />
        <RadialBarExample value={70} gradient="shade" color="purple" barWidthFactor={args.barWidth} />
      </Stack>
      <div>Spotlight + glow + centerGlow</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample
          value={30}
          gradient="shade"
          spotlight
          glowBar
          glowCenter
          color="blue"
          barWidthFactor={args.barWidth}
        />
        <RadialBarExample
          value={40}
          gradient="shade"
          spotlight
          glowBar
          glowCenter
          color="green"
          barWidthFactor={args.barWidth}
        />
        <RadialBarExample
          value={60}
          gradient="shade"
          spotlight
          glowBar
          glowCenter
          color="red"
          barWidthFactor={args.barWidth}
        />
        <RadialBarExample
          value={70}
          gradient="shade"
          spotlight
          glowBar
          glowCenter
          color="purple"
          barWidthFactor={args.barWidth}
        />
      </Stack>
      <div>Gradient: Scheme, startAngle: 240° endAngle: 120°</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample
          colorMode={FieldColorModeId.ContinuousGrYlRd}
          gradient={GraphGradientMode.Scheme}
          value={40}
          semicircle
          clockwise
          barWidthFactor={args.barWidth}
        />
        <RadialBarExample
          colorMode={FieldColorModeId.ContinuousGrYlRd}
          gradient={GraphGradientMode.Scheme}
          value={100}
          semicircle
          clockwise
          barWidthFactor={args.barWidth}
        />
      </Stack>
      <div>Sparklines</div>
      <Stack direction={'row'} gap={3}>
        <RadialBarExample
          value={70}
          gradient="hue"
          color="blue"
          clockwise
          semicircle
          {...args}
          sparkline={true}
          spotlight
        />
        <RadialBarExample
          value={30}
          gradient="hue"
          color="green"
          clockwise
          semicircle
          {...args}
          sparkline={true}
          spotlight
        />
        <RadialBarExample
          value={50}
          gradient="hue"
          color="red"
          clockwise
          semicircle
          {...args}
          sparkline={true}
          spotlight
        />
      </Stack>
    </Stack>
  );
};

Examples.parameters = {
  controls: { include: ['barWidth'] },
};

export const MultiSeries: StoryFn<StoryProps> = (args) => {
  return (
    <Stack direction={'column'} gap={3}>
      <RadialBarExample gradient="hue" color="red" {...args} />
    </Stack>
  );
};

MultiSeries.args = {
  barWidthFactor: 10,
};

interface ExampleProps {
  colorMode?: FieldColorModeId;
  gradient?: RadialGradientMode;
  color?: string;
  seriesName?: string;
  value?: number;
  semicircle?: boolean;
  min?: number;
  max?: number;
  clockwise?: boolean;
  size?: number;
  spotlight?: boolean;
  glowBar?: boolean;
  glowCenter?: boolean;
  barWidthFactor?: number;
  sparkline?: boolean;
  seriesCount?: number;
  vizCount?: number;
  textMode?: RadialTextMode;
}

function RadialBarExample({
  colorMode = FieldColorModeId.Fixed,
  gradient = 'none',
  color = 'blue',
  seriesName = 'Server A',
  value = 70,
  semicircle,
  min = 0,
  max = 100,
  clockwise = true,
  size = 200,
  spotlight = false,
  glowBar = false,
  glowCenter = false,
  barWidthFactor = 20,
  sparkline = false,
  seriesCount = 0,
  vizCount = 1,
  textMode = 'auto',
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
      ...getExtraSeries(seriesCount, colorMode, theme),
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

  const values = getFieldDisplayValues({
    fieldConfig: { overrides: [], defaults: {} },
    reduceOptions: { calcs: ['last'] },
    replaceVariables: (value) => value,
    theme: theme,
    data,
    sparkline,
  });

  return (
    <RadialGauge
      values={values}
      width={size}
      height={size}
      barWidthFactor={barWidthFactor}
      gradient={gradient}
      semicircle={semicircle}
      clockwise={clockwise}
      spotlight={spotlight}
      glowBar={glowBar}
      glowCenter={glowCenter}
      textMode={textMode}
      vizCount={vizCount}
    />
  );
}

function getExtraSeries(seriesCount: number, colorMode: FieldColorModeId, theme: GrafanaTheme2) {
  const fields: Field[] = [];
  const colors = ['blue', 'green', 'purple', 'orange', 'yellow'];

  for (let i = 0; i < seriesCount; i++) {
    fields.push({
      name: `Series ${i + 1}`,
      type: FieldType.number,
      values: [40, 45, 20, 25, 30, 28, 27, 30, 31, 26, 50, 55, 52, 20, 25, 30, 60, 20 * (i + 1)],
      config: {
        min: 0,
        max: 100,
        unit: 'percent',
        color: { mode: colorMode, fixedColor: theme.visualization.getColorByName(colors[i % colors.length]) },
      },
      // Add state and getLinks
      state: {},
      getLinks: () => [],
    });
  }

  return fields;
}

export default meta;
