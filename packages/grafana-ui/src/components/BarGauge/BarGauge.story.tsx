import { storiesOf } from '@storybook/react';
import { number, text, boolean } from '@storybook/addon-knobs';
import { BarGauge } from './BarGauge';
import { VizOrientation } from '../../types';
import { withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
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
    horizontal: boolean('horizontal', false),
    lcd: boolean('lcd', false),
  };
};

const BarGaugeStories = storiesOf('UI/BarGauge/BarGauge', module);

BarGaugeStories.addDecorator(withHorizontallyCenteredStory);

BarGaugeStories.add('Simple with basic thresholds', () => {
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
    horizontal,
    lcd,
  } = getKnobs();

  return renderComponentWithTheme(BarGauge, {
    width: 300,
    height: 300,
    value: { text: value.toString(), numeric: value },
    minValue: minValue,
    maxValue: maxValue,
    unit: unit,
    prefix: '',
    postfix: '',
    decimals: decimals,
    orientation: horizontal ? VizOrientation.Horizontal : VizOrientation.Vertical,
    displayMode: lcd ? 'lcd' : 'simple',
    thresholds: [
      { index: 0, value: -Infinity, color: 'green' },
      { index: 1, value: threshold1Value, color: threshold1Color },
      { index: 1, value: threshold2Value, color: threshold2Color },
    ],
  });
});
