import { action } from '@storybook/addon-actions';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { TagList } from './TagList';
import mdx from './TagList.mdx';

const meta: ComponentMeta<typeof TagList> = {
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
  },
};

export const List: ComponentStory<typeof TagList> = (args) => {
  return (
    <div style={{ width: 300 }}>
      <TagList tags={args.tags} onClick={args.onClick} displayMax={args.displayMax} icon={args.icon} />
    </div>
  );
};

export default meta;
