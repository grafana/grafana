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
    showBorder: false,
    showTooltip: false,
  },
};

export const Basic: ComponentStory<typeof UserIcon> = (args) => {
  const userView = {
    user: {
      id: 1,
      name: 'John Smith',
      avatarUrl: 'https://example.com/avatar.png',
      login: 'jsmith',
      email: 'jsmith@example.com',
      hasCustomAvatar: true,
    },
    viewed: '2023-04-18T15:00:00.000Z',
  };

  return <UserIcon {...args} userView={userView} />;
};

export default meta;
