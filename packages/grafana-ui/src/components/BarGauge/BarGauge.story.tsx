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
};

function addBarGaugeStory(overrides: Partial<Props>) {
  return ({ value, title, minValue, maxValue, threshold1Color, threshold2Color, threshold1Value, threshold2Value }) => {
    const theme = useTheme();

    const field: Partial<Field> = {
      type: FieldType.number,
      config: {
        min: minValue,
        max: maxValue,
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [
            { value: -Infinity, color: 'green' },
            { value: threshold1Value, color: threshold1Color },
            { value: threshold2Value, color: threshold2Color },
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
        text: value.toString(),
        title: title,
        numeric: value,
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

export const gradientVertical: Story<Props> = addBarGaugeStory({
  displayMode: BarGaugeDisplayMode.Gradient,
  orientation: VizOrientation.Vertical,
  height: 500,
  width: 100,
});

export const gradientHorizontal: Story<Props> = addBarGaugeStory({
  displayMode: BarGaugeDisplayMode.Gradient,
  orientation: VizOrientation.Horizontal,
  height: 100,
  width: 500,
});

export const lcdHorizontal: Story<Props> = addBarGaugeStory({
  displayMode: BarGaugeDisplayMode.Lcd,
  orientation: VizOrientation.Vertical,
  height: 500,
  width: 100,
});

gradientVertical.args = {
  value: 70,
  title: 'Title',
  minValue: 0,
  maxValue: 100,
  threshold1Value: 40,
  threshold1Color: 'orange',
  threshold2Value: 60,
  threshold2Color: 'red',
};
gradientHorizontal.args = {
  value: 70,
  title: 'Title',
  minValue: 0,
  maxValue: 100,
  threshold1Value: 40,
  threshold1Color: 'orange',
  threshold2Value: 60,
  threshold2Color: 'red',
};
lcdHorizontal.args = {
  value: 70,
  title: 'Title',
  minValue: 0,
  maxValue: 100,
  threshold1Value: 40,
  threshold1Color: 'orange',
  threshold2Value: 60,
  threshold2Color: 'red',
};
