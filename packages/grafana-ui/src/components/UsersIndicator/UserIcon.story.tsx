import { type Meta, type StoryFn } from '@storybook/react-webpack5';

import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';

import { UserIcon } from './UserIcon';
import mdx from './UserIcon.mdx';

const meta: Meta<typeof UserIcon> = {
  title: 'Iconography/UserIcon',
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

export const Basic: StoryFn<typeof UserIcon> = (args) => {
  const userView = {
    user: {
      name: 'John Smith',
      avatarUrl: 'https://picsum.photos/id/1/200/200',
    },
    lastActiveAt: '2023-04-18T15:00:00.000Z',
  };

  return <UserIcon {...args} userView={userView} />;
};

export const Examples: StoryFn<typeof UserIcon> = (args) => {
  const userView = {
    user: {
      name: 'John Smith',
      avatarUrl: 'https://picsum.photos/id/1/200/200',
    },
    lastActiveAt: '2023-04-18T15:00:00.000Z',
  };

  const examples = [
    {
      title: 'Interactive (click handler provided), user with avatar and tooltip',
      props: { userView, onClick: () => console.log('Avatar clicked'), showTooltip: true },
    },
    {
      title: 'Interactive, no tooltip',
      props: { userView, onClick: () => console.log('Avatar clicked'), showTooltip: false },
    },
    {
      title: 'Interactive, user with initials',
      props: {
        userView: {
          ...userView,
          user: { ...userView.user, avatarUrl: undefined },
        },
        onClick: () => console.log('Initials clicked'),
      },
    },
    { title: 'Non-interactive, with tooltip', props: { userView, showTooltip: true } },
    { title: 'Non-interactive, with initials', props: { userView, showTooltip: false } },
  ];

  return (
    <>
      {examples.map((example) => (
        <Stack direction="column" key={example.title}>
          <Text element="p">{example.title}</Text>
          <UserIcon {...args} {...example.props} />
        </Stack>
      ))}
    </>
  );
};

Basic.args = {
  showTooltip: true,
  onClick: undefined,
};

export default meta;
