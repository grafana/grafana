import { type Meta, type StoryFn } from '@storybook/react-webpack5';

import { RenderUserContentAsHTML } from './RenderUserContentAsHTML';
import mdx from './RenderUserContentAsHTML.mdx';

const meta: Meta<typeof RenderUserContentAsHTML> = {
  title: 'Utilities/RenderUserContentAsHTML',
  component: RenderUserContentAsHTML,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    content: {
      control: { type: 'text' },
    },
    component: {
      control: { type: 'text' },
    },
  },
};

export const Basic: StoryFn<typeof RenderUserContentAsHTML> = (props) => {
  return <RenderUserContentAsHTML {...props} />;
};

Basic.args = {
  content: '<a href="#">sample html anchor tag link</a>',
};

export default meta;
