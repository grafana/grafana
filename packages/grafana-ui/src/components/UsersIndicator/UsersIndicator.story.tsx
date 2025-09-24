import { Meta, StoryFn } from '@storybook/react';

import { UsersIndicator } from './UsersIndicator';
import mdx from './UsersIndicator.mdx';

const meta: Meta<typeof UsersIndicator> = {
  title: 'Iconography/UsersIndicator',
  component: UsersIndicator,
  argTypes: { limit: { control: { type: 'number', min: 1 } } },
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disabled: true,
    },
    controls: {
      exclude: ['className', 'onClick'],
    },
    actions: {
      disabled: true,
    },
  },
  args: {
    onClick: undefined,
  },
};

export const Basic: StoryFn<typeof UsersIndicator> = (args) => {
  const users = [
    {
      name: 'John Doe',
      avatarUrl: 'https://picsum.photos/id/1/200/200',
    },
    {
      name: 'Jane Smith',
      avatarUrl: '',
    },
    {
      name: 'Bob Johnson',
      avatarUrl: 'https://picsum.photos/id/3/200/200',
    },
  ];

  return <UsersIndicator {...args} users={users.map((user) => ({ user, lastActiveAt: new Date().toDateString() }))} />;
};

Basic.args = {
  limit: 4,
};

export const WithManyUsers: StoryFn<typeof UsersIndicator> = (args) => {
  const users = [
    {
      name: 'John Doe',
      avatarUrl: 'https://picsum.photos/id/1/200/200',
    },
    {
      name: 'Jane Smith',
      avatarUrl: '',
    },
    {
      name: 'Bob Johnson',
      avatarUrl: 'https://picsum.photos/id/3/200/200',
    },
    {
      name: 'John Smith',
      avatarUrl: 'https://picsum.photos/id/1/200/200',
    },
    {
      name: 'Jane Johnson',
      avatarUrl: '',
    },
  ];

  return <UsersIndicator {...args} users={users.map((user) => ({ user, lastActiveAt: new Date().toDateString() }))} />;
};

WithManyUsers.args = {
  limit: 4,
};

export default meta;
