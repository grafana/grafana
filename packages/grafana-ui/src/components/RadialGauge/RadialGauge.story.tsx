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

import { RadialGauge, RadialGaugeProps, RadialGradientMode, RadialShape, RadialTextMode } from './RadialGauge';

interface StoryProps extends RadialGaugeProps {
  value: number;
  seriesCount: number;
  sparkline: boolean;
}

const meta: Meta<StoryProps> = {
  title: 'Plugins/RadialGauge',
  component: RadialGauge,
  parameters: {
    controls: {
      exclude: ['theme', 'values', 'vizCount'],
    },
  },
  args: {
    barWidthFactor: 0.2,
    spotlight: false,
    glowBar: false,
    glowCenter: false,
    sparkline: false,
    value: undefined,
    width: 200,
    height: 200,
    shape: 'circle',
    gradient: 'hue',
    seriesCount: 1,
    segmentCount: 0,
    segmentSpacing: 0.4,
    roundedBars: true,
    thresholdsBar: false,
  },
  argTypes: {
    barWidthFactor: { control: { type: 'range', min: 0.1, max: 1, step: 0.01 } },
    width: { control: { type: 'range', min: 50, max: 600 } },
    height: { control: { type: 'range', min: 50, max: 600 } },
    value: { control: { type: 'range', min: 0, max: 110 } },
    spotlight: { control: 'boolean' },
    roundedBars: { control: 'boolean' },
    sparkline: { control: 'boolean' },
    thresholdsBar: { control: 'boolean' },
    gradient: { control: { type: 'radio', options: ['none', 'hue', 'shade', 'scheme'] } },
    seriesCount: { control: { type: 'range', min: 1, max: 20 } },
    segmentCount: { control: { type: 'range', min: 0, max: 100 } },
    segmentSpacing: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
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
  return (
    <Stack direction={'column'} gap={3} wrap="wrap">
      <div>Bar width</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample seriesName="0.1" value={60} gradient="hue" color="blue" barWidthFactor={0.1} />
        <RadialBarExample seriesName="0.4" value={60} gradient="hue" color="green" barWidthFactor={0.4} />
        <RadialBarExample seriesName="0.6" value={60} gradient="hue" color="red" barWidthFactor={0.6} />
        <RadialBarExample seriesName="0.8" value={60} gradient="hue" color="purple" barWidthFactor={0.8} />
      </Stack>

      <div>Gradient: Hue</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample value={30} gradient="hue" color="blue" />
        <RadialBarExample value={50} gradient="hue" color="green" />
        <RadialBarExample value={60} gradient="hue" color="red" />
        <RadialBarExample value={90} gradient="hue" color="purple" />
      </Stack>
      <div>Gradient: Shade</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample value={30} gradient="shade" color="blue" />
        <RadialBarExample value={40} gradient="shade" color="green" />
        <RadialBarExample value={60} gradient="shade" color="red" />
        <RadialBarExample value={70} gradient="shade" color="purple" />
      </Stack>
      <div>Spotlight + glow + centerGlow</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample value={30} gradient="shade" spotlight glowBar glowCenter color="blue" />
        <RadialBarExample value={40} gradient="shade" spotlight glowBar glowCenter color="green" />
        <RadialBarExample value={60} gradient="shade" spotlight glowBar glowCenter color="red" />
        <RadialBarExample value={70} gradient="shade" spotlight glowBar glowCenter color="purple" />
      </Stack>
      <div>Gradient: Scheme, startAngle: 240° endAngle: 120°</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialBarExample
          colorMode={FieldColorModeId.ContinuousGrYlRd}
          gradient={GraphGradientMode.Scheme}
          value={40}
          shape="gauge"
          roundedBars={false}
          glowBar={true}
          glowCenter={true}
          barWidthFactor={0.6}
        />
        <RadialBarExample
          colorMode={FieldColorModeId.ContinuousGrYlRd}
          gradient={GraphGradientMode.Scheme}
          value={90}
          barWidthFactor={0.6}
          roundedBars={false}
          glowBar={true}
          glowCenter={true}
          shape="gauge"
        />
      </Stack>
      <div>Sparklines</div>
      <Stack direction={'row'} gap={3}>
        <RadialBarExample
          value={70}
          gradient="hue"
          color="blue"
          shape="gauge"
          {...args}
          sparkline={true}
          spotlight
          glowBar={true}
          glowCenter={true}
        />
        <RadialBarExample
          value={30}
          gradient="hue"
          color="green"
          shape="gauge"
          {...args}
          sparkline={true}
          spotlight
          glowBar={true}
          glowCenter={true}
          barWidthFactor={0.4}
        />
        <RadialBarExample
          value={50}
          gradient="hue"
          color="red"
          shape="gauge"
          {...args}
          sparkline={true}
          spotlight
          glowBar={true}
          glowCenter={true}
          barWidthFactor={0.5}
        />
      </Stack>
      <div>Segmented</div>
      <Stack direction={'row'} gap={3}>
        <RadialBarExample
          value={70}
          gradient="shade"
          color="green"
          {...args}
          spotlight
          glowBar={true}
          glowCenter={true}
          segmentCount={8}
          barWidthFactor={0.4}
        />
        <RadialBarExample
          value={30}
          gradient="hue"
          color="green"
          {...args}
          segmentCount={20}
          spotlight
          glowBar={true}
          glowCenter={true}
          barWidthFactor={0.5}
        />
        <RadialBarExample
          value={50}
          gradient="hue"
          color="red"
          {...args}
          segmentCount={40}
          spotlight
          glowBar={true}
          glowCenter={true}
          barWidthFactor={0.4}
          segmentSpacing={0.2}
        />
      </Stack>
      <div>Segmented color scale</div>
      <Stack direction={'row'} gap={3}>
        <RadialBarExample
          value={70}
          {...args}
          gradient="scheme"
          colorMode={FieldColorModeId.ContinuousGrYlRd}
          spotlight
          glowBar={true}
          glowCenter={true}
          segmentCount={20}
          barWidthFactor={0.4}
        />
        <RadialBarExample
          value={70}
          {...args}
          gradient="scheme"
          colorMode={FieldColorModeId.ContinuousGrYlRd}
          spotlight
          shape="gauge"
          glowBar={true}
          glowCenter={true}
          segmentCount={20}
          barWidthFactor={0.4}
        />
      </Stack>
      <div>Thresholds</div>
      <Stack direction={'row'} gap={3}>
        <RadialBarExample
          value={70}
          {...args}
          gradient="scheme"
          colorMode={FieldColorModeId.Thresholds}
          thresholdsBar={true}
          roundedBars={false}
          spotlight
          glowCenter={true}
          barWidthFactor={0.7}
        />
        <RadialBarExample
          value={70}
          {...args}
          gradient="scheme"
          colorMode={FieldColorModeId.Thresholds}
          glowCenter={true}
          thresholdsBar={true}
          roundedBars={false}
          shape="gauge"
          barWidthFactor={0.7}
        />
        <RadialBarExample
          value={70}
          {...args}
          gradient="scheme"
          colorMode={FieldColorModeId.Thresholds}
          glowCenter={true}
          thresholdsBar={true}
          roundedBars={false}
          segmentCount={40}
          segmentSpacing={0.2}
          shape="gauge"
          barWidthFactor={0.7}
        />
      </Stack>
    </Stack>
  );
};

Examples.parameters = {
  controls: { include: ['barWidthFactor', 'value'] },
};

export const MultiSeries: StoryFn<StoryProps> = (args) => {
  return (
    <Stack direction={'column'} gap={3}>
      <RadialBarExample gradient="hue" color="red" {...args} />
    </Stack>
  );
};

MultiSeries.args = {
  barWidthFactor: 0.2,
};

export const Temp: StoryFn<StoryProps> = (args) => {
  return (
    <Stack direction={'column'} gap={3}>
      <RadialBarExample
        {...args}
        gradient="scheme"
        colorMode={FieldColorModeId.ContinuousReds}
        color="red"
        shape="gauge"
        roundedBars={false}
        barWidthFactor={0.8}
        spotlight
      />
    </Stack>
  );
};

interface ExampleProps {
  colorMode?: FieldColorModeId;
  gradient?: RadialGradientMode;
  color?: string;
  seriesName?: string;
  value?: number;
  shape?: RadialShape;
  min?: number;
  max?: number;
  width?: number;
  height?: number;
  spotlight?: boolean;
  glowBar?: boolean;
  glowCenter?: boolean;
  barWidthFactor?: number;
  sparkline?: boolean;
  seriesCount?: number;
  vizCount?: number;
  textMode?: RadialTextMode;
  segmentCount?: number;
  segmentSpacing?: number;
  roundedBars?: boolean;
  thresholdsBar?: boolean;
}

function RadialBarExample({
  colorMode = FieldColorModeId.Fixed,
  gradient = 'none',
  color = 'blue',
  seriesName = 'Server A',
  value = 70,
  shape = 'circle',
  min = 0,
  max = 100,
  width = 200,
  height = 200,
  spotlight = false,
  glowBar = false,
  glowCenter = false,
  barWidthFactor = 0.4,
  sparkline = false,
  seriesCount = 0,
  vizCount = 1,
  textMode = 'auto',
  segmentCount = 0,
  segmentSpacing = 0.1,
  roundedBars = true,
  thresholdsBar = false,
}: ExampleProps) {
  const theme = useTheme2();

  if (gradient === 'scheme' && colorMode === FieldColorModeId.Fixed) {
    colorMode = FieldColorModeId.ContinuousGrYlRd;
  }

  if (thresholdsBar) {
    colorMode = FieldColorModeId.Thresholds;
  }

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
          thresholds: {
            mode: 'absolute',
            steps: [
              { value: -Infinity, color: 'green' },
              { value: 65, color: 'orange' },
              { value: 85, color: 'red' },
            ],
          },
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
      width={width}
      height={height}
      barWidthFactor={barWidthFactor}
      gradient={gradient}
      shape={shape}
      spotlight={spotlight}
      glowBar={glowBar}
      glowCenter={glowCenter}
      textMode={textMode}
      vizCount={vizCount}
      segmentCount={segmentCount}
      segmentSpacing={segmentSpacing}
      roundedBars={roundedBars}
      thresholdsBar={thresholdsBar}
    />
  );
}

function getExtraSeries(seriesCount: number, colorMode: FieldColorModeId, theme: GrafanaTheme2) {
  const fields: Field[] = [];
  const colors = ['blue', 'green', 'purple', 'orange', 'yellow'];

  for (let i = 1; i < seriesCount; i++) {
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
