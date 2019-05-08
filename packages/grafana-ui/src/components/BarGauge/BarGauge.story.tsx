import { storiesOf } from '@storybook/react';
import { number, text, select } from '@storybook/addon-knobs';
import { BarGauge, Props } from './BarGauge';
import { VizOrientation } from '../../types';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import { getFieldDisplayProcessor } from '../../utils/scale';
import { getTheme } from '../../themes/index';
import { ColorScheme } from '../../types/scale';

const getKnobs = (showThresholds = true) => {
  if (showThresholds) {
    return {
      value: number('value', 70),
      title: text('title', 'Title'),
      minValue: number('minValue', 0),
      maxValue: number('maxValue', 100),
      threshold1Value: number('threshold1Value', 40),
      threshold1Color: text('threshold1Color', 'orange'),
      threshold2Value: number('threshold2Value', 60),
      threshold2Color: text('threshold2Color', 'red'),
      sceme: '',
    };
  }
  return {
    value: number('value', 70),
    title: text('title', 'Title'),
    minValue: number('minValue', 0),
    maxValue: number('maxValue', 100),
    threshold1Value: 40,
    threshold1Color: 'x',
    threshold2Value: 60,
    threshold2Color: 'x',
    scheme: select('Scheme', Object.keys(ColorScheme), ColorScheme.Blues),
  };
};

const BarGaugeStories = storiesOf('UI/BarGauge/BarGauge', module);

BarGaugeStories.addDecorator(withCenteredStory);

function addBarGaugeStory(name: string, overrides: Partial<Props>, showThresholds = true) {
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
      scheme,
    } = getKnobs(showThresholds);

    const field = {
      name: 'test',
      min: minValue,
      max: maxValue,
      scale: {
        scheme: scheme as ColorScheme,
        thresholds: [
          { index: 0, value: -Infinity, color: 'green' },
          { index: 1, value: threshold1Value, color: threshold1Color },
          { index: 1, value: threshold2Value, color: threshold2Color },
        ],
      },
    };

    if (!showThresholds) {
      delete field.scale.thresholds;
    }

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
      displayMode: 'basic',
      field: getFieldDisplayProcessor(field, getTheme()),
    };

    Object.assign(props, overrides);
    return renderComponentWithTheme(BarGauge, props);
  });
}

addBarGaugeStory('Gradient Vertical', {
  displayMode: 'gradient',
  orientation: VizOrientation.Vertical,
  height: 500,
  width: 100,
});

addBarGaugeStory('Gradient Horizontal', {
  displayMode: 'gradient',
  orientation: VizOrientation.Horizontal,
  height: 100,
  width: 500,
});

addBarGaugeStory('LCD Horizontal', {
  displayMode: 'lcd',
  orientation: VizOrientation.Vertical,
  height: 500,
  width: 100,
});

addBarGaugeStory(
  'Chromatic Gradient',
  {
    displayMode: 'gradient',
    orientation: VizOrientation.Horizontal,
    height: 100,
    width: 500,
  },
  false
);
