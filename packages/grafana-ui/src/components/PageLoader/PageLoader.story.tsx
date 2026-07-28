import { type Meta, type StoryFn } from '@storybook/react-webpack5';

import { PageLoader } from './PageLoader';
import mdx from './PageLoader.mdx';

const meta: Meta<typeof PageLoader> = {
  title: 'Information/PageLoader',
  component: PageLoader,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic: StoryFn<typeof PageLoader> = () => {
  return (
    // approx full page height - this doesn't need to be exact, it's only a story
    <div style={{ height: 'calc(100vh - 60px)' }}>
      <PageLoader />
    </div>
  );
};

export default meta;
