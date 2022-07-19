import { action } from '@storybook/addon-actions';
import { Story } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { Props as TagProps, Tag } from './Tag';
import mdx from './Tag.mdx';

export default {
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
    showIcon: false,
  },
};

interface StoryProps extends TagProps {
  showIcon?: boolean;
}

export const Single: Story<StoryProps> = (args) => {
  return (
    <Tag
      name={args.name}
      colorIndex={args.colorIndex}
      onClick={action('Tag clicked')}
      icon={args.showIcon ? args.icon : undefined}
    />
  );
};
