import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { UserIcon } from './UserIcon';
import mdx from './UserIcon.mdx';

const meta: ComponentMeta<typeof UserIcon> = {
  title: 'General/UserIcon',
  component: UserIcon,
  argTypes: {},
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disabled: true,
    },
    controls: {
      exclude: ['className'],
    },
    actions: {
      disabled: true,
    },
  },
  args: {
    showTooltip: false,
  },
};

export const Basic: ComponentStory<typeof UserIcon> = (args) => {
  const userView = {
    user: {
      id: 1,
      name: 'John Smith',
      avatarUrl: 'https://picsum.photos/id/1/200/200',
      login: 'jsmith',
      email: 'jsmith@example.com',
      hasCustomAvatar: true,
    },
    viewed: '2023-04-18T15:00:00.000Z',
  };

  return <UserIcon {...args} userView={userView} />;
};
Basic.args = {
  showTooltip: true,
};

export const MultipleUsers: ComponentStory<typeof UserIcon> = (args) => {
  const users = [
    {
      id: 1,
      name: 'John Doe',
      avatarUrl: 'https://picsum.photos/id/1/200/200',
      login: 'johndoe',
      email: 'johndoe@example.com',
      hasCustomAvatar: true,
    },
    {
      id: 2,
      name: 'Jane Smith',
      avatarUrl: 'https://picsum.photos/id/2/200/200',
      login: 'janesmith',
      email: 'janesmith@example.com',
      hasCustomAvatar: false,
    },
    {
      id: 3,
      name: 'Bob Johnson',
      avatarUrl: 'https://picsum.photos/id/3/200/200',
      login: 'bobjohnson',
      email: 'bobjohnson@example.com',
      hasCustomAvatar: true,
    },
  ];

  return (
    <div style={{ display: 'flex' }}>
      {users.map((user) => (
        <UserIcon {...args} key={user.id} userView={{ user, viewed: new Date().toDateString() }} />
      ))}
    </div>
  );
};

export default meta;
