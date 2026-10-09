import { type Meta, type StoryFn } from '@storybook/react';
import { action } from 'storybook/actions';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { Button } from '../Button/Button';
import { Stack } from '../Layout/Stack/Stack';

import { ColorCard } from './ColorCard';
import mdx from './ColorCard.mdx';

const meta: Meta = {
  title: 'Information/ColorCard',
  component: ColorCard,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {},
};

export const Basic: StoryFn<typeof ColorCard> = (args) => {
  return (
    <div>
      <ColorCard {...args}>
        Child content that includes some alert details, like maybe what actually happened.
      </ColorCard>
    </div>
  );
};

Basic.args = {
  variant: 'error',
  title: 'Basic',
};

export const Examples: StoryFn<typeof ColorCard> = () => {
  const variants = ['card', 'info'];

  return (
    <Stack direction="column">
      <StoryExample name="With buttonContent and children">
        {variants.map((variant) => (
          <ColorCard size="sm" key={variant} variant={variant}>
            <ColorCard.Icon name="exclamation-circle" />
            <ColorCard.Title>My title</ColorCard.Title>
            <ColorCard.Content>Some long content</ColorCard.Content>
            <ColorCard.Actions>
              <Button variant="secondary" onClick={action('Remove button clicked')}>
                Close
              </Button>
            </ColorCard.Actions>
          </ColorCard>
        ))}
      </StoryExample>
    </Stack>
  );
};

export default meta;
