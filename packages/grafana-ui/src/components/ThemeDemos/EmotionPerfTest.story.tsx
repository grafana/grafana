import { type Meta, type StoryFn } from '@storybook/react-webpack5';

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
