import { storiesOf } from '@storybook/react';
import { number, text } from '@storybook/addon-knobs';
import { BarGauge, Props, BarGaugeDisplayMode } from './BarGauge';
import { VizOrientation, ThresholdsMode, Field, FieldType, getDisplayProcessor } from '@grafana/data';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

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

const BarGaugeStories = storiesOf('Visualizations/BarGauge', module);

BarGaugeStories.addDecorator(withCenteredStory);

function addBarGaugeStory(name: string, overrides: Partial<Props>) {
  BarGaugeStories.add(name, () => {
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
  });
}

addBarGaugeStory('Gradient Vertical', {
  displayMode: BarGaugeDisplayMode.Gradient,
  orientation: VizOrientation.Vertical,
  height: 500,
  width: 100,
});

addBarGaugeStory('Gradient Horizontal', {
  displayMode: BarGaugeDisplayMode.Gradient,
  orientation: VizOrientation.Horizontal,
  height: 100,
  width: 500,
});

addBarGaugeStory('LCD Horizontal', {
  displayMode: BarGaugeDisplayMode.Lcd,
  orientation: VizOrientation.Vertical,
  height: 500,
  width: 100,
});
