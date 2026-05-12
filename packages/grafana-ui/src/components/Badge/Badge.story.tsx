import { type Meta, type StoryFn } from '@storybook/react-webpack5';

import { iconOptions } from '../../utils/storybook/icons';
import { Stack } from '../Layout/Stack/Stack';

import { Badge } from './Badge';
import mdx from './Badge.mdx';

const meta: Meta<typeof Badge> = {
  title: 'Information/Badge',
  component: Badge,
  parameters: {
    docs: { page: mdx },
  },
  argTypes: {
    icon: {
      options: Object.keys(iconOptions),
      control: {
        type: 'select',
        labels: iconOptions,
      },
    },
    color: { control: 'select' },
    text: { control: 'text' },
  },
};

const Template: StoryFn<typeof Badge> = (args) => <Badge {...args} />;

export const Basic = Template.bind({});

Basic.args = {
  text: 'Badge label',
  color: 'blue',
  icon: 'rocket',
};

export const Examples: StoryFn<typeof Badge> = () => (
  <Stack direction="column" alignItems="flex-start">
    <Badge text="Blue" color="blue" icon="check" />
    <Badge text="Red" color="red" icon="check" />
    <Badge text="Green" color="green" icon="check" />
    <Badge text="Orange" color="orange" icon="check" />
    <Badge text="Purple" color="purple" icon="check" />
    <Badge text="Dark Grey" color="darkgrey" icon="check" />
    <Badge text="Brand" color="brand" icon="check" />
  </Stack>
);

export default meta;
