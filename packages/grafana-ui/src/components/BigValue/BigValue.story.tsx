import React from 'react';
import { Story } from '@storybook/react';
import { BigValue, BigValueColorMode, BigValueGraphMode, BigValueJustifyMode, BigValueTextMode } from './BigValue';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './BigValue.mdx';
import { useTheme } from '../../themes';
import { ArrayVector, FieldSparkline, FieldType } from '@grafana/data';

export default {
  title: 'Visualizations/BigValue',
  component: BigValue,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disabled: true,
    },
  },
  argTypes: {
    width: { control: { type: 'range', min: 200, max: 800 } },
    height: { control: { type: 'range', min: 200, max: 800 } },
    colorMode: { control: { type: 'select', options: [BigValueColorMode.Value, BigValueColorMode.Background] } },
    graphMode: { control: { type: 'select', options: [BigValueGraphMode.Area, BigValueGraphMode.None] } },
    justifyMode: { control: { type: 'select', options: [BigValueJustifyMode.Auto, BigValueJustifyMode.Center] } },
    textMode: {
      control: {
        type: 'select',
        options: [BigValueTextMode.Auto, BigValueTextMode.Name, BigValueTextMode.ValueAndName, BigValueTextMode.None],
      },
    },
    color: { control: 'color' },
    sparkline: {
      table: {
        disable: true,
      },
    },
    onClick: {
      table: {
        disable: true,
      },
    },
    className: {
      table: {
        disable: true,
      },
    },
    alignmentFactors: {
      table: {
        disable: true,
      },
    },
    text: {
      table: {
        disable: true,
      },
    },
    count: {
      table: {
        disable: true,
      },
    },
    theme: {
      table: {
        disable: true,
      },
    },
  },
};

interface StoryProps {
  value: string;
  title: string;
  colorMode: BigValueColorMode;
  graphMode: BigValueGraphMode;
  height: number;
  width: number;
  color: string;
  textMode: BigValueTextMode;
  justifyMode: BigValueJustifyMode;
}

export const Basic: Story<StoryProps> = ({
  value,
  title,
  colorMode,
  graphMode,
  height,
  width,
  color,
  textMode,
  justifyMode,
}) => {
  const theme = useTheme();
  const sparkline: FieldSparkline = {
    y: {
      name: '',
      values: new ArrayVector([1, 2, 3, 4, 3]),
      type: FieldType.number,
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
        text: value,
        numeric: 5022,
        color: color,
        title,
      }}
      sparkline={graphMode === BigValueGraphMode.None ? undefined : sparkline}
    />
  );
};

Basic.args = {
  value: '$5022',
  title: 'Total Earnings',
  colorMode: BigValueColorMode.Value,
  graphMode: BigValueGraphMode.Area,
  justifyMode: BigValueJustifyMode.Auto,
  width: 400,
  height: 300,
  color: 'red',
  textMode: BigValueTextMode.Auto,
};
