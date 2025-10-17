import { Meta, StoryFn } from '@storybook/react';

import {
  applyFieldOverrides,
  Field,
  FieldType,
  getFieldDisplayValues,
  GrafanaTheme2,
  toDataFrame,
} from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema';

import { useTheme2 } from '../../themes/ThemeContext';
import { Stack } from '../Layout/Stack/Stack';

import { RadialGauge, RadialGaugeProps, RadialGradientMode, RadialShape, RadialTextMode } from './RadialGauge';

interface StoryProps extends RadialGaugeProps {
  value: number;
  seriesCount: number;
  sparkline: boolean;
  colorScheme: FieldColorModeId;
  decimals: number;
}

const meta: Meta<StoryProps> = {
  title: 'Plugins/RadialGauge',
  component: RadialGauge,
  excludeStories: ['RadialGaugeExample'],
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
    gradient: 'none',
    seriesCount: 1,
    segmentCount: 0,
    segmentSpacing: 0.2,
    roundedBars: false,
    thresholdsBar: false,
    colorScheme: FieldColorModeId.Thresholds,
    decimals: 0,
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
    gradient: { control: { type: 'radio' } },
    seriesCount: { control: { type: 'range', min: 1, max: 20 } },
    segmentCount: { control: { type: 'range', min: 0, max: 100 } },
    segmentSpacing: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    colorScheme: {
      control: { type: 'select' },
      options: [
        FieldColorModeId.Thresholds,
        FieldColorModeId.Fixed,
        FieldColorModeId.ContinuousGrYlRd,
        FieldColorModeId.ContinuousBlYlRd,
        FieldColorModeId.ContinuousBlPu,
      ],
    },
    decimals: { control: { type: 'range', min: 0, max: 7 } },
  },
};

export const Basic: StoryFn<StoryProps> = (args) => {
  const visualizations: React.ReactNode[] = [];
  const colors = ['blue', 'green', 'red', 'purple', 'orange', 'yellow', 'dark-red', 'dark-blue', 'dark-green'];

  for (let i = 0; i < args.seriesCount; i++) {
    const color = args.colorScheme === FieldColorModeId.Fixed ? colors[i % colors.length] : undefined;

    visualizations.push(
      <RadialGaugeExample {...args} key={i} color={color} seriesCount={0} vizCount={args.seriesCount} />
    );
  }

  return (
    <Stack direction={'row'} gap={3} wrap="wrap">
      {visualizations}
    </Stack>
  );
};

export const Examples: StoryFn<StoryProps> = (args) => {
  return (
    <Stack direction={'column'} gap={3} wrap="wrap">
      <div>Bar width</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialGaugeExample
          seriesName="0.1"
          value={args.value ?? 30}
          color="blue"
          gradient="auto"
          barWidthFactor={0.1}
        />
        <RadialGaugeExample
          seriesName="0.4"
          value={args.value ?? 40}
          color="green"
          gradient="auto"
          barWidthFactor={0.4}
        />
        <RadialGaugeExample
          seriesName="0.6"
          value={args.value ?? 60}
          color="red"
          gradient="auto"
          barWidthFactor={0.6}
        />
        <RadialGaugeExample
          seriesName="0.8"
          value={args.value ?? 70}
          color="purple"
          gradient="auto"
          barWidthFactor={0.8}
        />
      </Stack>
      <div>Effects</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialGaugeExample value={args.value ?? 30} spotlight glowBar glowCenter color="blue" gradient="auto" />
        <RadialGaugeExample value={args.value ?? 40} spotlight glowBar glowCenter color="green" gradient="auto" />
        <RadialGaugeExample
          value={args.value ?? 60}
          spotlight
          glowBar
          glowCenter
          color="red"
          gradient="auto"
          roundedBars
        />
        <RadialGaugeExample
          value={args.value ?? 70}
          spotlight
          glowBar
          glowCenter
          color="purple"
          gradient="auto"
          roundedBars
        />
      </Stack>
      <div>Shape: Gauge & color scale</div>
      <Stack direction="row" alignItems="center" gap={3} wrap="wrap">
        <RadialGaugeExample
          value={40}
          shape="gauge"
          width={250}
          gradient="auto"
          colorScheme={FieldColorModeId.ContinuousGrYlRd}
          glowCenter={true}
          barWidthFactor={0.6}
        />
        <RadialGaugeExample
          colorScheme={FieldColorModeId.ContinuousGrYlRd}
          gradient="auto"
          width={250}
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
        <RadialGaugeExample
          value={args.value ?? 70}
          color="blue"
          shape="gauge"
          gradient="auto"
          sparkline={true}
          spotlight
          glowBar={true}
          glowCenter={true}
          barWidthFactor={0.2}
        />
        <RadialGaugeExample
          value={args.value ?? 30}
          color="green"
          shape="gauge"
          gradient="auto"
          sparkline={true}
          spotlight
          glowBar={true}
          glowCenter={true}
          barWidthFactor={0.8}
        />
        <RadialGaugeExample
          value={args.value ?? 50}
          color="red"
          shape="gauge"
          width={250}
          gradient="auto"
          sparkline={true}
          spotlight
          glowBar={true}
          glowCenter={true}
          barWidthFactor={0.2}
        />
        <RadialGaugeExample
          value={args.value ?? 50}
          color="red"
          width={250}
          shape="gauge"
          gradient="auto"
          sparkline={true}
          spotlight
          glowBar={true}
          glowCenter={true}
          barWidthFactor={0.8}
        />
      </Stack>
      <div>Segmented</div>
      <Stack direction={'row'} gap={3}>
        <RadialGaugeExample
          value={args.value ?? 70}
          color="green"
          gradient="auto"
          glowCenter={true}
          segmentCount={8}
          segmentSpacing={0.1}
          barWidthFactor={0.4}
        />
        <RadialGaugeExample
          value={args.value ?? 30}
          color="purple"
          gradient="auto"
          segmentCount={30}
          glowCenter={true}
          barWidthFactor={0.6}
        />
        <RadialGaugeExample
          value={args.value ?? 50}
          color="red"
          gradient="auto"
          segmentCount={40}
          glowCenter={true}
          barWidthFactor={1}
          segmentSpacing={0.6}
        />
      </Stack>
      <div>Segmented color scale</div>
      <Stack direction={'row'} gap={3}>
        <RadialGaugeExample
          value={args.value ?? 80}
          colorScheme={FieldColorModeId.ContinuousGrYlRd}
          spotlight
          glowBar={true}
          glowCenter={true}
          segmentCount={20}
          barWidthFactor={0.4}
        />
        <RadialGaugeExample
          value={args.value ?? 80}
          width={250}
          colorScheme={FieldColorModeId.ContinuousGrYlRd}
          spotlight
          shape="gauge"
          gradient="auto"
          glowBar={true}
          glowCenter={true}
          segmentCount={40}
          segmentSpacing={0.5}
          barWidthFactor={0.8}
        />
      </Stack>
      <div>Thresholds</div>
      <Stack direction={'row'} gap={3}>
        <RadialGaugeExample
          value={args.value ?? 70}
          colorScheme={FieldColorModeId.Thresholds}
          gradient="auto"
          thresholdsBar={true}
          roundedBars={false}
          spotlight
          glowCenter={true}
          barWidthFactor={0.7}
        />
        <RadialGaugeExample
          value={args.value ?? 70}
          width={250}
          colorScheme={FieldColorModeId.Thresholds}
          gradient="auto"
          glowCenter={true}
          thresholdsBar={true}
          roundedBars={false}
          shape="gauge"
          barWidthFactor={0.7}
        />
        <RadialGaugeExample
          value={args.value ?? 70}
          width={250}
          colorScheme={FieldColorModeId.Thresholds}
          gradient="auto"
          glowCenter={true}
          thresholdsBar={true}
          roundedBars={false}
          segmentCount={40}
          segmentSpacing={0.3}
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
      <RadialGaugeExample color="red" {...args} />
    </Stack>
  );
};

MultiSeries.args = {
  barWidthFactor: 0.2,
};

export const Temp: StoryFn<StoryProps> = (args) => {
  return (
    <Stack direction={'column'} gap={3}>
      <RadialGaugeExample
        {...args}
        colorScheme={FieldColorModeId.ContinuousReds}
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
  colorScheme?: FieldColorModeId;
  decimals?: number;
  showScaleLabels?: boolean;
}

export function RadialGaugeExample({
  gradient = 'none',
  color,
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
  roundedBars = false,
  thresholdsBar = false,
  colorScheme = FieldColorModeId.Thresholds,
  decimals = 0,
  showScaleLabels,
}: ExampleProps) {
  const theme = useTheme2();

  if (color) {
    colorScheme = FieldColorModeId.Fixed;
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
          decimals: decimals,
          color: { mode: colorScheme, fixedColor: color ? theme.visualization.getColorByName(color) : undefined },
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
      ...getExtraSeries(seriesCount, colorScheme, decimals, theme),
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
      showScaleLabels={showScaleLabels}
    />
  );
}

function getExtraSeries(seriesCount: number, colorScheme: FieldColorModeId, decimals: number, theme: GrafanaTheme2) {
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
        decimals: decimals,
        unit: 'percent',
        color: { mode: colorScheme, fixedColor: theme.visualization.getColorByName(colors[i % colors.length]) },
      },
      // Add state and getLinks
      state: {},
      getLinks: () => [],
    });
  }

  return fields;
}

export default meta;
