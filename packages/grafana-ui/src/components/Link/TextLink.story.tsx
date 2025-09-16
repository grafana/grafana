import { Meta, StoryFn } from '@storybook/react';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { Stack } from '../Layout/Stack/Stack';
import { Text } from '../Text/Text';

import { TextLink } from './TextLink';
import mdx from './TextLink.mdx';

const meta: Meta = {
  title: 'Foundations/TextLink',
  component: TextLink,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: { exclude: ['href', 'external'] },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'bodySmall', undefined],
    },
    weight: {
      control: 'select',
      options: ['bold', 'medium', 'light', 'regular', undefined],
    },
    color: {
      control: 'select',
      options: ['primary', 'secondary', 'disabled', 'link', 'maxContrast', undefined],
    },
    inline: { control: 'boolean' },
  },
  args: {
    href: 'https://www.grafana.com',
    external: true,
    icon: 'external-link-alt',
  },
};

export const Example: StoryFn = (args) => {
  return (
    <Stack direction="column">
      <StoryExample name="This is a 'inline + external' link with the default behaviour">
        <Text element="p">
          To get started with a forever free Grafana Cloud account, sign up at &#160;
          <TextLink href="https://grafana.com/" {...args} inline>
            grafana.com
          </TextLink>
          .
        </Text>
      </StoryExample>
      <StoryExample name="This is a 'standalone + external' link with the default behaviour">
        <TextLink href="https://grafana.com/docs/grafana/latest/" external inline={false} {...args}>
          Learn how in the docs
        </TextLink>
      </StoryExample>
      <hr />
      <Text element="p">
        *The examples cannot contemplate an internal link due to conflicts between Storybook and React Router
      </Text>
    </Stack>
  );
};

Example.parameters = {
  controls: { exclude: ['href', 'external', 'variant', 'weight', 'color', 'inline', 'icon'] },
};

export const Inline: StoryFn = (args) => {
  return (
    <div>
      For more information{' '}
      <TextLink href={args.href} {...args}>
        see Grafana.com
      </TextLink>
    </div>
  );
};

Inline.args = {
  inline: true,
};

export const Standalone: StoryFn = (args) => {
  return (
    <div>
      <TextLink href={args.href} {...args}>
        Go to Grafana.com
      </TextLink>
    </div>
  );
};

Standalone.args = {
  inline: false,
};

export default meta;
