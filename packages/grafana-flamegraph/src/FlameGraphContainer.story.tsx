import type { Meta, StoryFn, StoryObj } from '@storybook/react';
import { ComponentProps } from 'react';

import { createDataFrame } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { data } from './FlameGraph/testData/dataNestedSet';
import FlameGraphContainer, { Props } from './FlameGraphContainer';

const WrappedFlameGraph = (props: Omit<Props, 'getTheme'>) => {
  const theme = useTheme2();
  const df = createDataFrame(data);
  return <FlameGraphContainer {...props} data={df} getTheme={() => theme} />;
};

const StoryRenderFn: StoryFn<ComponentProps<typeof FlameGraphContainer>> = (args) => {
  return <WrappedFlameGraph {...args} />;
};

const meta: Meta<typeof FlameGraphContainer> = {
  title: 'FlameGraph',
  render: StoryRenderFn,
};

export default meta;
export const Basic: StoryObj<typeof meta> = {};
