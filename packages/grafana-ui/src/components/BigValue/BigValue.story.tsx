import { Story, Meta } from '@storybook/react';
import React from 'react';

import { ArrayVector, FieldSparkline, FieldType } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import {
  BigValue,
  BigValueColorMode,
  BigValueGraphMode,
  BigValueJustifyMode,
  BigValueTextMode,
  Props,
} from './BigValue';
import mdx from './BigValue.mdx';

const meta: Meta = {
  title: 'Visualizations/BigValue',
  component: BigValue,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['value', 'sparkline', 'onClick', 'className', 'alignmentFactors', 'text', 'count', 'theme'],
    },
  },
  argTypes: {
    width: { control: { type: 'range', min: 200, max: 800 } },
    height: { control: { type: 'range', min: 200, max: 800 } },
    colorMode: {
      control: { type: 'select', options: [BigValueColorMode.Value, BigValueColorMode.Background] },
    },
    graphMode: { control: { type: 'select', options: [BigValueGraphMode.Area, BigValueGraphMode.None] } },
    justifyMode: { control: { type: 'select', options: [BigValueJustifyMode.Auto, BigValueJustifyMode.Center] } },
    textMode: {
      control: {
        type: 'radio',
        options: [
          BigValueTextMode.Auto,
          BigValueTextMode.Name,
          BigValueTextMode.ValueAndName,
          BigValueTextMode.None,
          BigValueTextMode.Value,
        ],
      },
    },
    color: { control: 'color' },
  },
};

interface StoryProps extends Partial<Props> {
  numeric: number;
  title: string;
  color: string;
  valueText: string;
}

export const Basic: Story<StoryProps> = ({
  valueText,
  title,
  colorMode,
  graphMode,
  height,
  width,
  color,
  textMode,
  justifyMode,
}) => {
  const theme = useTheme2();
  const sparkline: FieldSparkline = {
    y: {
      name: '',
      values: new ArrayVector([1, 2, 3, 4, 3]),
      type: FieldType.number,
      state: { range: { min: 1, max: 4, delta: 3 } },
      config: {},
    },
  };

  return (
    <BigValue
      theme={theme}
      width={width}
      height={height}
      colorMode={colorMode}
      graphMode={graphMode}
      textMode={textMode}
      justifyMode={justifyMode}
      value={{
        text: valueText,
        numeric: 5022,
        color: color,
        title,
      }}
      sparkline={graphMode === BigValueGraphMode.None ? undefined : sparkline}
    />
  );
};

Basic.args = {
  valueText: '$5022',
  title: 'Total Earnings',
  colorMode: BigValueColorMode.Value,
  graphMode: BigValueGraphMode.Area,
  justifyMode: BigValueJustifyMode.Auto,
  width: 400,
  height: 300,
  color: 'red',
  textMode: BigValueTextMode.Auto,
};

export default meta;
