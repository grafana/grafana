import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';

import { TagList } from './TagList';
import mdx from './TagList.mdx';

const meta: Meta<typeof TagList> = {
  title: 'Information/TagList',
  component: TagList,
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

export const List: StoryFn<typeof TagList> = (args) => {
  return (
    <div style={{ width: 300 }}>
      <TagList tags={args.tags} onClick={args.onClick} displayMax={args.displayMax} icon={args.icon} />
    </div>
  );
};

export default meta;
