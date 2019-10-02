import { storiesOf } from '@storybook/react';
import { number, text, object } from '@storybook/addon-knobs';
import { PieChart, PieChartType } from './PieChart';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

const getKnobs = () => {
  return {
    datapoints: object('datapoints', [
      {
        value: 100,
        name: '100',
        color: '#7EB26D',
      },
      {
        value: 200,
        name: '200',
        color: '#6ED0E0',
      },
    ]),
    pieType: text('pieType', PieChartType.PIE),
    strokeWidth: number('strokeWidth', 1),
    unit: text('unit', 'ms'),
  };
};

const PieChartStories = storiesOf('UI/PieChart/PieChart', module);

PieChartStories.addDecorator(withCenteredStory);

PieChartStories.add('Pie type: pie', () => {
  const { datapoints, pieType, strokeWidth, unit } = getKnobs();

  return renderComponentWithTheme(PieChart, {
    width: 200,
    height: 400,
    datapoints,
    pieType,
    strokeWidth,
    unit,
  });
});
