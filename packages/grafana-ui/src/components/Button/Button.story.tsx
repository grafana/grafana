import { action } from '@storybook/addon-actions';
import { StoryFn } from '@storybook/react';

import { ComponentSize } from '../../types';
import { Card } from '../Card/Card';
import { Stack } from '../Layout/Stack/Stack';

import { allButtonVariants, allButtonFills, Button, ButtonProps } from './Button';
import mdx from './Button.mdx';
import { ButtonGroup } from './ButtonGroup';

const sizes: ComponentSize[] = ['lg', 'md', 'sm'];

export default {
  title: 'Buttons/Button',
  component: Button,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    size: {
      options: sizes,
    },
    tooltip: {
      control: 'text',
    },
    disabled: {
      control: 'boolean',
    },
    className: {
      table: {
        disable: true,
      },
    },
  },
};

export const Examples: StoryFn<typeof Button> = () => {
  return (
    <Stack direction="column">
      {allButtonFills.map((buttonFill) => (
        <Stack direction="column" key={buttonFill}>
          <Stack gap={3}>
            {allButtonVariants.map((variant) => (
              <Stack direction="column" gap={3} alignItems="flex-start" key={`${buttonFill}-${variant}`}>
                {sizes.map((size) => (
                  <Button variant={variant} fill={buttonFill} size={size} key={size}>
                    {variant} {size}
                  </Button>
                ))}
                <Button variant={variant} fill={buttonFill} disabled>
                  {variant} disabled
                </Button>
              </Stack>
            ))}
          </Stack>
          <div style={{ padding: '20px 0', width: '100%' }} />
        </Stack>
      ))}
      <Stack alignItems="center" gap={3}>
        <div>With icon and text</div>
        <Button icon="cloud" size="sm">
          Configure
        </Button>
        <Button icon="cloud">Configure</Button>
        <Button icon="cloud" size="lg">
          Configure
        </Button>
      </Stack>
      <div />
      <div />
      <Button icon="plus" fullWidth>
        Button with fullWidth
      </Button>
      <div />
      <Stack alignItems="center" gap={3}>
        <div>Inside ButtonGroup</div>
        <ButtonGroup>
          <Button icon="sync">Run query</Button>
          <Button icon="angle-down" />
        </ButtonGroup>
        <ButtonGroup>
          <Button variant="destructive" icon="sync">
            Run query
          </Button>
          <Button variant="destructive" icon="angle-down" />
        </ButtonGroup>
        <ButtonGroup>
          <Button variant="success" icon="sync">
            Run query
          </Button>
          <Button variant="success" icon="angle-down" />
        </ButtonGroup>
        <ButtonGroup>
          <Button variant="secondary" icon="sync">
            Run query
          </Button>
          <Button variant="secondary" icon="angle-down" />
        </ButtonGroup>
      </Stack>
      <Card>
        <Card.Heading>Button inside card</Card.Heading>
        <Card.Actions>
          {allButtonVariants.map((variant) => (
            <Button variant={variant} key={variant}>
              {variant}
            </Button>
          ))}
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </Card.Actions>
      </Card>
    </Stack>
  );
};

export const Basic: StoryFn<typeof Button> = (args: ButtonProps) => (
  <Button onClick={action('clicked button')} {...args} />
);

Basic.args = {
  children: 'Example button',
  size: 'md',
  variant: 'primary',
  fill: 'solid',
  type: 'button',
};
