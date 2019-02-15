import { storiesOf } from '@storybook/react';
import { number, text } from '@storybook/addon-knobs';
import { BarGauge } from './BarGauge';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

const getKnobs = () => {
  return {
    value: number('value', 70),
    minValue: number('minValue', 0),
    maxValue: number('maxValue', 100),
    threshold1Value: number('threshold1Value', 40),
    threshold1Color: text('threshold1Color', 'orange'),
    threshold2Value: number('threshold2Value', 60),
    threshold2Color: text('threshold2Color', 'red'),
    unit: text('unit', 'ms'),
    decimals: number('decimals', 1),
  };
};

const BarGaugeStories = storiesOf('UI/BarGauge/BarGauge', module);

BarGaugeStories.addDecorator(withCenteredStory);

BarGaugeStories.add('Vertical, with basic thresholds', () => {
  const {
    value,
    minValue,
    maxValue,
    threshold1Color,
    threshold2Color,
    threshold1Value,
    threshold2Value,
    unit,
    decimals,
  } = getKnobs();

  return renderComponentWithTheme(BarGauge, {
    width: 300,
    height: 600,
    value: value,
    minValue: minValue,
    maxValue: maxValue,
    unit: unit,
    prefix: '',
    postfix: '',
    decimals: decimals,
    thresholds: [
      { index: 0, value: null, color: 'green' },
      { index: 1, value: threshold1Value, color: threshold1Color },
      { index: 1, value: threshold2Value, color: threshold2Color },
    ],
  });
});
