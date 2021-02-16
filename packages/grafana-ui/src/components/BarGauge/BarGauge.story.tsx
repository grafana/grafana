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
    theme: {
      table: {
        disable: true,
      },
    },
    height: {
      table: {
        disable: true,
      },
    },
    width: {
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
    itemSpacing: {
      table: {
        disable: true,
      },
    },
    lcdCellWidth: {
      table: {
        disable: true,
      },
    },
    displayMode: {
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
    showUnfilled: {
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
}

function addBarGaugeStory(overrides: Partial<Props>) {
  return (storyProps: StoryProps) => {
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

    const props: Props = {
      theme,
      width: 300,
      height: 300,
      value: {
        text: storyProps.value.toString(),
        title: storyProps.title,
        numeric: storyProps.value,
      },
      orientation: VizOrientation.Vertical,
      displayMode: BarGaugeDisplayMode.Basic,
      field: field.config!,
      display: field.display!,
    };

    Object.assign(props, overrides);

    return <BarGauge {...props} />;
  };
}

export const gradientVertical: Story<StoryProps> = addBarGaugeStory({
  displayMode: BarGaugeDisplayMode.Gradient,
  orientation: VizOrientation.Vertical,
  height: 500,
  width: 100,
});

export const gradientHorizontal: Story<StoryProps> = addBarGaugeStory({
  displayMode: BarGaugeDisplayMode.Gradient,
  orientation: VizOrientation.Horizontal,
  height: 100,
  width: 500,
});

export const lcdHorizontal: Story<StoryProps> = addBarGaugeStory({
  displayMode: BarGaugeDisplayMode.Lcd,
  orientation: VizOrientation.Vertical,
  height: 500,
  width: 100,
});

gradientVertical.args = gradientHorizontal.args = lcdHorizontal.args = {
  value: 70,
  title: 'Title',
  minValue: 0,
  maxValue: 100,
  threshold1Value: 40,
  threshold1Color: 'orange',
  threshold2Value: 60,
  threshold2Color: 'red',
};
