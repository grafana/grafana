import { Meta, StoryFn } from '@storybook/react';

import { Avatar } from './Avatar';
import mdx from './Avatar.mdx';

const meta: Meta<typeof Avatar> = {
  title: 'Iconography/Avatar',
  component: Avatar,
  parameters: {
    docs: { page: mdx },
    controls: { exclude: ['alt'] },
  },
  argTypes: {
    width: { control: 'number' },
    height: { control: 'number' },
  },
};

const Template: StoryFn<typeof Avatar> = (args) => <Avatar {...args} />;

export const Basic = Template.bind({});

Basic.args = {
  src: 'https://secure.gravatar.com/avatar',
  alt: 'User avatar',
  width: 3,
  height: 3,
};

export default meta;
