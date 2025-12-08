import type { Meta, StoryObj } from '@storybook/react';

import { createDataFrame } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { data } from './FlameGraph/testData/dataNestedSet';
import FlameGraphContainer, { Props } from './FlameGraphContainer';

const WrappedFlameGraph = (props: Omit<Props, 'getTheme'>) => {
  const theme = useTheme2();
  const df = createDataFrame(data);
  return <FlameGraphContainer {...props} data={df} getTheme={() => theme} />;
};

const meta: Meta<typeof FlameGraphContainer> = {
  title: 'FlameGraphContainer',
  render: (args) => {
    return <WrappedFlameGraph {...args} />;
  },
};

export default meta;
export const Basic: StoryObj<typeof meta> = {};
