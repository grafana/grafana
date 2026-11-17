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
      <div style={{ width: '100%', height: 'calc(100vh - 64px)' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

const render: StoryObj<typeof meta>['render'] = (args) => {
  const dataContainer = new FlameGraphDataContainer(createDataFrame(data), { collapsing: true });

  return <FlameGraphCallTreeContainer {...args} data={dataContainer} onSymbolClick={() => {}} onSandwich={() => {}} />;
};

export const Basic: StoryObj<typeof meta> = { render };

export const DeepStack: StoryObj<typeof meta> = {
  render,
  args: { search: 'chunkWriter' },
};

export const DeepStackNarrow: StoryObj<typeof meta> = {
  render,
  args: { search: 'chunkWriter' },
  decorators: [
    (Story) => (
      <div style={{ width: '700px', height: 'calc(100vh - 64px)' }}>
        <Story />
      </div>
    ),
  ],
};
