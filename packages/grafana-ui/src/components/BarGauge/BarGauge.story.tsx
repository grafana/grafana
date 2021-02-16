import React from 'react';
import { Story } from '@storybook/react';
import { BarGauge, BarGaugeDisplayMode } from '@grafana/ui';
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
      disabled: true,
    },
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
    theme: {
      table: {
        disable: true,
      },
    },
    field: {
      table: {
        disable: true,
      },
    },
    display: {
      table: {
        disable: true,
      },
    },
    orientation: {
      table: {
        disable: true,
      },
    },
    text: {
      table: {
        disable: true,
      },
    },
    onClick: {
      table: {
        disable: true,
      },
    },
    className: {
      table: {
        disable: true,
      },
    },
    alignmentFactors: {
      table: {
        disable: true,
      },
    },
  },
};

interface StoryProps {
  value: number;
  title: string;
  minValue: number;
  maxValue: number;
  threshold1Color: string;
  threshold2Color: string;
  threshold1Value: number;
  threshold2Value: number;
  displayMode: BarGaugeDisplayMode;
  orientation: VizOrientation;
  height: number;
  width: number;
  lcdCellWidth: number;
  itemSpacing: number;
  showUnfilled: boolean;
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
      text: storyProps.value.toString(),
      title: storyProps.title,
      numeric: storyProps.value,
    },
    displayMode: storyProps.displayMode,
    orientation: storyProps.orientation,
    field: field.config!,
    display: field.display!,
  };

  return <BarGauge {...props} />;
};

export const gradientVertical: Story<StoryProps> = AddBarGaugeStory.bind({});

export const gradientHorizontal: Story<StoryProps> = AddBarGaugeStory.bind({});

gradientHorizontal.args = {
  value: 70,
  title: 'Title',
  minValue: 0,
  maxValue: 100,
  threshold1Value: 40,
  threshold1Color: 'orange',
  threshold2Value: 60,
  threshold2Color: 'red',
  displayMode: BarGaugeDisplayMode.Gradient,
  height: 100,
  width: 500,
  orientation: VizOrientation.Horizontal,
  lcdCellWidth: 12,
  itemSpacing: 8,
  showUnfilled: true,
};
gradientVertical.args = {
  value: 70,
  title: 'Title',
  minValue: 0,
  maxValue: 100,
  threshold1Value: 40,
  threshold1Color: 'orange',
  threshold2Value: 60,
  threshold2Color: 'red',
  displayMode: BarGaugeDisplayMode.Gradient,
  height: 500,
  width: 100,
  orientation: VizOrientation.Vertical,
  lcdCellWidth: 12,
  itemSpacing: 8,
  showUnfilled: true,
};
