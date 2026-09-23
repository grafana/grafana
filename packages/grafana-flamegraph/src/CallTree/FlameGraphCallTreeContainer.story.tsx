import { type Meta, type StoryObj } from '@storybook/react';

import { createDataFrame } from '@grafana/data';

import { FlameGraphDataContainer } from '../FlameGraph/dataTransform';
import { data } from '../FlameGraph/testData/dataNestedSet';

import FlameGraphCallTreeContainer from './FlameGraphCallTreeContainer';

const meta: Meta<typeof FlameGraphCallTreeContainer> = {
  title: 'CallTree',
  component: FlameGraphCallTreeContainer,
  args: {
    search: '',
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
      <FlameGraphCallTreeContainer {...args} data={dataContainer} onSymbolClick={() => {}} onSandwich={() => {}} />
    );
  },
};
