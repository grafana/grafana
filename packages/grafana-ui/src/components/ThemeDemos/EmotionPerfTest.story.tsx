import { Meta, StoryFn } from '@storybook/react';

import { EmotionPerfTest } from './EmotionPerfTest';

const meta: Meta = {
  title: 'Developers/Emotion perf test',
  decorators: [],
  parameters: {
    options: {
      showPanel: false,
    },
    docs: {},
  },
};

export const PerfTest: StoryFn = () => {
  return <EmotionPerfTest />;
};

export default meta;
