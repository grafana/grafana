import { Meta, StoryObj } from '@storybook/react';

import { createDataFrame } from '@grafana/data';

import { ColorScheme, SelectedView } from '../types';

import FlameGraph from './FlameGraph';
import { CollapsedMap, FlameGraphDataContainer } from './dataTransform';
import { data } from './testData/dataBasic';

const meta: Meta<typeof FlameGraph> = {
  title: 'FlameGraph',
  component: FlameGraph,
  args: {
    rangeMin: 0,
    rangeMax: 1,
    textAlign: 'left',
    colorScheme: ColorScheme.PackageBased,
    selectedView: SelectedView.Both,
    search: '',
  },
};

export default meta;
export const Basic: StoryObj<typeof meta> = {
  render: (args) => {
    const dataContainer = new FlameGraphDataContainer(createDataFrame(data), { collapsing: false });

    return <FlameGraph {...args} data={dataContainer} collapsedMap={new CollapsedMap()} />;
  },
};
