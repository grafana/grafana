import { text, select, number, color } from '@storybook/addon-knobs';
import { BigValue, BigValueColorMode, BigValueGraphMode, BigValueTextMode } from './BigValue';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

const getKnobs = () => {
  return {
    value: text('value', '$5022'),
    title: text('title', 'Total Earnings'),
    colorMode: select('Color mode', [BigValueColorMode.Value, BigValueColorMode.Background], BigValueColorMode.Value),
    graphMode: select('Graph mode', [BigValueGraphMode.Area, BigValueGraphMode.None], BigValueGraphMode.Area),
    width: number('Width', 400, { range: true, max: 800, min: 200 }),
    height: number('Height', 300, { range: true, max: 800, min: 200 }),
    color: color('Value color', 'red'),
    textMode: select(
      'Text mode',
      [BigValueTextMode.Auto, BigValueTextMode.Name, BigValueTextMode.ValueAndName, BigValueTextMode.None],
      BigValueTextMode.Auto
    ),
  };
};

export default {
  title: 'Visualizations/BigValue',
  component: BigValue,
  decorators: [withCenteredStory],
};

export const basic = () => {
  const { value, title, colorMode, graphMode, height, width, color, textMode } = getKnobs();

  return renderComponentWithTheme(BigValue, {
    width: width,
    height: height,
    colorMode: colorMode,
    graphMode: graphMode,
    textMode,
    value: {
      text: value,
      numeric: 5022,
      color: color,
      title,
    },
    sparkline: {
      minX: 0,
      maxX: 5,
      data: [
        [0, 10],
        [1, 20],
        [2, 15],
        [3, 25],
        [4, 5],
        [5, 10],
      ],
    },
  });
};
