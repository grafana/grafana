import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { Tag } from './Tag';
import mdx from './Tag.mdx';

const meta: Meta<typeof Tag> = {
  title: 'Forms/Tags/Tag',
  component: Tag,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['onClick'],
    },
  },
  args: {
    name: 'Tag',
    colorIndex: 0,
  },
};

export const Single: StoryFn<typeof Tag> = (args) => {
  return <Tag name={args.name} colorIndex={args.colorIndex} onClick={action('Tag clicked')} icon={args.icon} />;
};

export default meta;
