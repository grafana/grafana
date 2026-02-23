import { Meta, StoryObj } from '@storybook/react';

import { createDataFrame } from '@grafana/data';

import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { data } from '../FlameGraph/testData/dataNestedSet';
import { ColorScheme } from '../types';

import FlameGraphTopTableContainer from './FlameGraphTopTableContainer';

const meta: Meta<typeof FlameGraphTopTableContainer> = {
  title: 'TopTable',
  component: FlameGraphTopTableContainer,
  args: {
    colorScheme: ColorScheme.ValueBased,
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', height: '600px' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
export const Basic: StoryObj<typeof meta> = {
  render: (args) => {
    const dataContainer = new FlameGraphDataContainer(createDataFrame(data), { collapsing: true });

    return (
      <FlameGraphTopTableContainer
        {...args}
        data={dataContainer}
        onSymbolClick={() => {}}
        onSearch={() => {}}
        onSandwich={() => {}}
      />
    );
  },
};
