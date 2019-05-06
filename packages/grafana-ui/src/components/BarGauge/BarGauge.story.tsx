import { storiesOf } from '@storybook/react';
import { number, text } from '@storybook/addon-knobs';
import { BarGauge, Props } from './BarGauge';
import { VizOrientation } from '../../types';
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

const BarGaugeStories = storiesOf('UI/BarGauge/BarGauge', module);

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

    const props: Props = {
      theme: {} as any,
      width: 300,
      height: 300,
      value: {
        text: value.toString(),
        title: title,
        numeric: value,
      },
      minValue: minValue,
      maxValue: maxValue,
      orientation: VizOrientation.Vertical,
      displayMode: 'basic',
      thresholds: [
        { index: 0, value: -Infinity, color: 'green' },
        { index: 1, value: threshold1Value, color: threshold1Color },
        { index: 1, value: threshold2Value, color: threshold2Color },
      ],
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
