import { Meta, StoryObj } from '@storybook/react';

import { createDataFrame } from '@grafana/data';

import { FlameGraphDataContainer } from '../../FlameGraph/dataTransform';
import { data } from '../../FlameGraph/testData/dataNestedSet';
import { ColorScheme } from '../../types';

import FlameGraphCallTreeContainer from './FlameGraphCallTreeContainer';

const meta: Meta<typeof FlameGraphCallTreeContainer> = {
  title: 'CallTree',
  component: FlameGraphCallTreeContainer,
  args: {
    colorScheme: ColorScheme.PackageBased,
    search: '',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', height: '1000px' }}>
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
      <FlameGraphCallTreeContainer
        {...args}
        data={dataContainer}
        onSymbolClick={(symbol) => {
          console.log('Symbol clicked:', symbol);
        }}
        onSandwich={(item) => {
          console.log('Sandwich:', item);
        }}
        onSearch={(symbol) => {
          console.log('Search:', symbol);
        }}
      />
    );
  },
};
