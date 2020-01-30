import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { MicroPlot } from './MicroPlot';
import mdx from './MicroPlot.mdx';
import { toDataFrame } from '@grafana/data';

export default {
  title: 'UI/uPlot',
  component: MicroPlot,
  decorators: [withCenteredStory],
  parameters: {
    docs: mdx,
  },
};

const data = toDataFrame({
  fields: [{ values: [1, 2, 3, 4, 5] }, { values: [1, 4, 3, 1, 5] }, { values: [4, 2, 3, 4, 3] }],
});

export const simple = () => <MicroPlot width={400} height={300} data={data} />;
