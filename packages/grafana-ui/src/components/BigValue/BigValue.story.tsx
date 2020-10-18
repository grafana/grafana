import React from 'react';
import { color, number, select, text } from '@storybook/addon-knobs';
import { BigValue, BigValueColorMode, BigValueGraphMode, BigValueJustifyMode, BigValueTextMode } from './BigValue';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './BigValue.mdx';
import { useTheme } from '../../themes';

const getKnobs = () => {
  return {
    value: text('value', '$5022'),
    title: text('title', 'Total Earnings'),
    colorMode: select('Color mode', [BigValueColorMode.Value, BigValueColorMode.Background], BigValueColorMode.Value),
    graphMode: select('Graph mode', [BigValueGraphMode.Area, BigValueGraphMode.None], BigValueGraphMode.Area),
    justifyMode: select('Justify', [BigValueJustifyMode.Auto, BigValueJustifyMode.Center], BigValueJustifyMode.Auto),
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
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  const { value, title, colorMode, graphMode, height, width, color, textMode, justifyMode } = getKnobs();
  const sparkline = {
    xMin: 0,
    xMax: 5,
    data: [
      [0, 10],
      [1, 20],
      [2, 15],
      [3, 25],
      [4, 5],
      [5, 10],
    ],
  };

  return (
    <BigValue
      // eslint-disable-next-line react-hooks/rules-of-hooks
      theme={useTheme()}
      width={width}
      height={height}
      colorMode={colorMode}
      graphMode={graphMode}
      textMode={textMode}
      justifyMode={justifyMode}
      value={{
        text: value,
        numeric: 5022,
        color: color,
        title,
      }}
      sparkline={graphMode === BigValueGraphMode.None ? undefined : sparkline}
    />
  );
};
