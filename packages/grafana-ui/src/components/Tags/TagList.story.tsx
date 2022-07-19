import { action } from '@storybook/addon-actions';
import { Story } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { TagList, Props as TagListProps } from './TagList';
import mdx from './TagList.mdx';

export default {
  title: 'Forms/Tags/TagList',
  component: TagList,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['className', 'onClick', 'getAriaLabel'],
    },
  },
  args: {
    displayMax: 3,
    tags: ['datasource-test', 'gdev', 'mysql', 'mssql'],
    onClick: action('Tag clicked'),
    showIcon: false,
  },
};

interface StoryProps extends TagListProps {
  showIcon?: boolean;
}

export const List: Story<StoryProps> = (args) => {
  return (
    <div style={{ width: 300 }}>
      <TagList
        tags={args.tags}
        onClick={args.onClick}
        displayMax={args.displayMax}
        icon={args.showIcon ? args.icon : undefined}
      />
    </div>
  );
};
