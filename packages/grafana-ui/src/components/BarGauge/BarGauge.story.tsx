import React from 'react';
import { Story } from '@storybook/react';
import { BarGauge, BarGaugeDisplayMode } from '@grafana/ui';
import { NOOP_CONTROL } from '../../utils/storybook/noopControl';
import { VizOrientation, ThresholdsMode, Field, FieldType, getDisplayProcessor } from '@grafana/data';
import { Props } from './BarGauge';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './BarGauge.mdx';
import { useTheme } from '../../themes';

export default {
  title: 'Visualizations/BarGauge',
  component: BarGauge,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disable: true,
    },
  },
  args: {
    numeric: 70,
    title: 'Title',
    minValue: 0,
    maxValue: 100,
    threshold1Value: 40,
    threshold1Color: 'orange',
    threshold2Value: 60,
    threshold2Color: 'red',
    displayMode: BarGaugeDisplayMode.Gradient,
    lcdCellWidth: 12,
    itemSpacing: 8,
    showUnfilled: true,
  },
  argTypes: {
    displayMode: {
      control: {
        type: 'select',
        options: [BarGaugeDisplayMode.Lcd, BarGaugeDisplayMode.Gradient, BarGaugeDisplayMode.Basic],
      },
    },
    width: { control: { type: 'range', min: 200, max: 800 } },
    height: { control: { type: 'range', min: 200, max: 800 } },
    threshold1Color: { control: 'color' },
    threshold2Color: { control: 'color' },
    theme: NOOP_CONTROL,
    field: NOOP_CONTROL,
    value: NOOP_CONTROL,
    display: NOOP_CONTROL,
    orientation: NOOP_CONTROL,
    text: NOOP_CONTROL,
    onClick: NOOP_CONTROL,
    className: NOOP_CONTROL,
    alignmentFactors: NOOP_CONTROL,
  },
};

interface StoryProps extends Partial<Props> {
  numeric: number;
  title: string;
  minValue: number;
  maxValue: number;
  threshold1Color: string;
  threshold2Color: string;
  threshold1Value: number;
  threshold2Value: number;
}

const AddBarGaugeStory = (storyProps: StoryProps) => {
  const theme = useTheme();

  const field: Partial<Field> = {
    type: FieldType.number,
    config: {
      min: storyProps.minValue,
      max: storyProps.maxValue,
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: storyProps.threshold1Value, color: storyProps.threshold1Color },
          { value: storyProps.threshold2Value, color: storyProps.threshold2Color },
        ],
      },
    },
  };
  field.display = getDisplayProcessor({ field });

  const props: Partial<Props> = {
    theme,
    lcdCellWidth: storyProps.lcdCellWidth,
    itemSpacing: storyProps.itemSpacing,
    showUnfilled: storyProps.showUnfilled,
    width: storyProps.width,
    height: storyProps.height,
    value: {
      text: storyProps.numeric.toString(),
      title: storyProps.title,
      numeric: storyProps.numeric,
    },
    displayMode: storyProps.displayMode,
    orientation: storyProps.orientation,
    field: field.config!,
    display: field.display!,
  };

  return <BarGauge {...props} />;
};

export const barGaugeVertical: Story<StoryProps> = AddBarGaugeStory.bind({});
barGaugeVertical.args = {
  height: 500,
  width: 100,
  orientation: VizOrientation.Vertical,
};

export const barGaugeHorizontal: Story<StoryProps> = AddBarGaugeStory.bind({});
barGaugeHorizontal.args = {
  height: 100,
  width: 500,
  orientation: VizOrientation.Horizontal,
};
