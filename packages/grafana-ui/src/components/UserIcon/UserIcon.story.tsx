import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { UserIcon } from './UserIcon';
import mdx from './UserIcon.mdx';

const meta: ComponentMeta<typeof UserIcon> = {
  title: 'General/UsersIndicator/UserIcon',
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
      exclude: ['className', 'onClick'],
    },
    actions: {
      disabled: true,
    },
  },
  args: {
    showTooltip: false,
    onClick: undefined,
  },
};

export const Basic: ComponentStory<typeof UserIcon> = (args) => {
  const userView = {
    user: {
      name: 'John Smith',
      avatarUrl: 'https://picsum.photos/id/1/200/200',
    },
    lastActiveAt: '2023-04-18T15:00:00.000Z',
  };

  return <UserIcon {...args} userView={userView} />;
};
Basic.args = {
  showTooltip: true,
  onClick: undefined,
};

export default meta;
