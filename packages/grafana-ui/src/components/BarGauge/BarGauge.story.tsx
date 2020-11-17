import { number, text } from '@storybook/addon-knobs';
import { BarGauge, BarGaugeDisplayMode } from '@grafana/ui';
import { VizOrientation, ThresholdsMode, Field, FieldType, getDisplayProcessor } from '@grafana/data';
import { Props } from './BarGauge';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import mdx from './BarGauge.mdx';

const getKnobs = () => {
  return {
    value: number('value', 70),
    title: text('title', 'Title'),
    minValue: number('minValue', 0),
    maxValue: number('maxValue', 100),
    threshold1Value: number('threshold1Value', 40),
    threshold1Color: text('threshold1Color', 'orange'),
    threshold2Value: number('threshold2Value', 60),
    threshold2Color: text('threshold2Color', 'red'),
  };
};

export default {
  title: 'Visualizations/BarGauge',
  component: BarGauge,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

function addBarGaugeStory(overrides: Partial<Props>) {
  const {
    value,
    title,
    minValue,
    maxValue,
    threshold1Color,
    threshold2Color,
    threshold1Value,
    threshold2Value,
  } = getKnobs();

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
    theme: {} as any,
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
  return renderComponentWithTheme(BarGauge, props);
}

export const gradientVertical = addBarGaugeStory({
  displayMode: BarGaugeDisplayMode.Gradient,
  orientation: VizOrientation.Vertical,
  height: 500,
  width: 100,
});

export const gradientHorizontal = addBarGaugeStory({
  displayMode: BarGaugeDisplayMode.Gradient,
  orientation: VizOrientation.Horizontal,
  height: 100,
  width: 500,
});

export const lcdHorizontal = addBarGaugeStory({
  displayMode: BarGaugeDisplayMode.Lcd,
  orientation: VizOrientation.Vertical,
  height: 500,
  width: 100,
});
