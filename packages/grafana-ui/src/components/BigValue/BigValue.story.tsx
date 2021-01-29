import React from 'react';
import { Story } from '@storybook/react';
import { ArrayVector, FieldSparkline, FieldType } from '@grafana/data';
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
  argTypes: {},
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
      sparkline={args.graphMode === BigValueGraphMode.None ? undefined : sparkline}
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
  textMode: BigValueTextMode.Auto,
};
