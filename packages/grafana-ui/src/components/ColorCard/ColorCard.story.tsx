import { type StoryFn, type Meta } from '@storybook/react-webpack5';
import { action } from 'storybook/actions';

import { StoryExample } from '../../utils/storybook/StoryExample';
import { Button } from '../Button/Button';
import { Stack } from '../Layout/Stack/Stack';

import { ColorCard, type ColorCardSize, type ColorCardVariant } from './ColorCard';
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

const variants: ColorCardVariant[] = ['default', 'error', 'warning', 'info', 'success'] as const;

export const Examples: StoryFn<typeof ColorCard> = () => {
  return (
    <Stack direction="column">
      {variants.map((variant) => (
        <SimpleExampleWithButton key={variant} variant={variant} size="sm" />
      ))}
    </Stack>
  );
};

function SimpleExampleWithButton({ variant, size }: { variant: ColorCardVariant; size: ColorCardSize }) {
  return (
    <Stack direction="column">
      <StoryExample name="With buttonContent and children">
        <ColorCard size={size} variant={variant}>
          <ColorCard.Icon name="exclamation-circle" />
          <ColorCard.Title>My title</ColorCard.Title>
          <ColorCard.Content>Some long content</ColorCard.Content>
          <ColorCard.Actions>
            <Button variant="secondary" onClick={action('Remove button clicked')}>
              Close
            </Button>
          </ColorCard.Actions>
        </ColorCard>
      </StoryExample>
    </Stack>
  );
}

export default meta;
