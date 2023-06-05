import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { RenderUserContentAsHTML } from './RenderUserContentAsHTML';
import mdx from './RenderUserContentAsHTML.mdx';

const meta: ComponentMeta<typeof RenderUserContentAsHTML> = {
  title: 'General/RenderUserContentAsHTML',
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

export const Basic: ComponentStory<typeof RenderUserContentAsHTML> = (props) => {
  return <RenderUserContentAsHTML {...props} />;
};

Basic.args = {
  content: '<a href="#">sample html anchor tag link</a>',
};

export default meta;
