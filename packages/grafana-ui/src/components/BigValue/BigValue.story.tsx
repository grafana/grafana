import React from 'react';
import { Story } from '@storybook/react';
import { ArrayVector, FieldType } from '@grafana/data';
import {
  BigValue,
  BigValueColorMode,
  BigValueGraphMode,
  BigValueJustifyMode,
  BigValueTextMode,
  Props,
} from './BigValue';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './BigValue.mdx';
import { useTheme } from '../../themes';

export default {
  title: 'Visualizations/BigValue',
  component: BigValue,
  decorators: [withCenteredStory],
  argTypes: {
    justifyMode: { control: { type: 'radio', options: [BigValueJustifyMode.Auto, BigValueJustifyMode.Center] } },
    textMode: {
      control: {
        type: 'radio',
        options: [
          BigValueTextMode.Auto,
          BigValueTextMode.Name,
          BigValueTextMode.None,
          BigValueTextMode.Value,
          BigValueTextMode.ValueAndName,
        ],
      },
    },
    value: { control: { type: 'object' } },
    sparkline: { control: { type: 'object' } },
    className: { control: { disable: true } },
    theme: { control: { disable: true } },
    count: { control: { disable: true } },
    alignmentFactors: { control: { disable: true } },
    text: { control: { disable: true } },
  },
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disable: true,
    },
  },
};

export const Basic: Story<Props> = (args) => {
  const theme = useTheme();

  return (
    <BigValue
      theme={theme}
      width={args.width}
      height={args.height}
      colorMode={args.colorMode}
      graphMode={args.graphMode}
      textMode={args.textMode}
      justifyMode={args.justifyMode}
      value={{
        text: args.value.text,
        numeric: 5022,
        color: args.value.color,
        title: args.value.title,
      }}
      sparkline={args.graphMode === BigValueGraphMode.None ? undefined : args.sparkline}
    />
  );
};

Basic.args = {
  value: {
    text: '$5022',
    numeric: 5022,
    title: 'Total Earnings',
    color: 'red',
  },
  width: 400,
  height: 300,
  colorMode: BigValueColorMode.Value,
  graphMode: BigValueGraphMode.Area,
  justifyMode: BigValueJustifyMode.Auto,
  textMode: BigValueTextMode.ValueAndName,
  sparkline: {
    y: {
      name: '',
      values: new ArrayVector([1, 2, 3, 4, 3]),
      type: FieldType.number,
      config: {},
    },
  },
};
