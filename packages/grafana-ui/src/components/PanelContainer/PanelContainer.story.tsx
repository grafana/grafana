import { Meta, StoryFn } from '@storybook/react';

import { PanelContainer } from './PanelContainer';
import mdx from './PanelContainer.mdx';

const meta: Meta<typeof PanelContainer> = {
  title: 'Layout/Deprecated/PanelContainer',
  component: PanelContainer,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic: StoryFn<typeof PanelContainer> = () => {
  return (
    <PanelContainer>
      <h1>Here could be your component</h1>
    </PanelContainer>
  );
};

export default meta;
