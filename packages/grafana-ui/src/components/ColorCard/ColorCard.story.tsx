import { type StoryFn, type Meta } from '@storybook/react-webpack5';
import { action } from 'storybook/actions';

import { Link, TextLink } from '../..';
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
    <Stack direction="column" gap={4}>
      <SimpleExampleWithButton title="Default title" content={getExampleContent()} variant={'default'} size="md" />
      <SimpleExampleWithButton title="Info title" content={getExampleContent()} variant={'info'} size="md" />
      <SimpleExampleWithButton title="Success title" content={getExampleContent()} variant={'success'} size="md" />
      <SimpleExampleWithButton title="Warning title" content={getExampleContent()} variant={'warning'} size="md" />
      <SimpleExampleWithButton title="Error title" content={getExampleContent()} variant={'error'} size="md" />
    </Stack>
  );
};

function getExampleContent() {
  return (
    <span>
      Child content that includes some alert details, and a link to{' '}
      <TextLink href="http://www.example.com" external>
        more details
      </TextLink>
    </span>
  );
}

export const Variants: StoryFn<typeof ColorCard> = () => {
  return (
    <Stack direction="column" gap={4}>
      {variants.map((variant) => (
        <SimpleExampleWithButton key={variant} variant={variant} size="md" content="My box content" />
      ))}
    </Stack>
  );
};

export const Sizes: StoryFn<typeof ColorCard> = () => {
  const sizes: ColorCardSize[] = ['sm', 'md', 'lg'] as const;
  return (
    <Stack direction="column" gap={4}>
      {sizes.map((size) => (
        <SimpleExampleWithButton
          key={size}
          content="Some example content that is not very long but still has a few words"
          variant="default"
          size={size}
        />
      ))}
    </Stack>
  );
};

function SimpleExampleWithButton({
  title = 'Card title',
  variant,
  size = 'md',
  content,
}: {
  title?: string;
  variant: ColorCardVariant;
  content?: React.ReactNode;
  size?: ColorCardSize;
}) {
  return (
    <ColorCard size={size} variant={variant}>
      {/* No name, so the icon comes from the variant */}
      <ColorCard.Icon />
      <ColorCard.Title>{title}</ColorCard.Title>
      {content && <ColorCard.Content>{content}</ColorCard.Content>}
      <ColorCard.Actions>
        <Button variant="secondary" onClick={action('Remove button clicked')} size={size === 'sm' ? 'sm' : 'md'}>
          Close
        </Button>
      </ColorCard.Actions>
    </ColorCard>
  );
}

export default meta;
