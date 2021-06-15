import React from 'react';
import { Story, Meta } from '@storybook/react';
import { allButtonVariants, allButtonFills, Button, ButtonProps } from './Button';
import mdx from './Button.mdx';
import { HorizontalGroup, VerticalGroup } from '../Layout/Layout';
import { ButtonGroup } from './ButtonGroup';
import { ComponentSize } from '../../types/size';
import { Card } from '../Card/Card';

export default {
  title: 'Buttons/Button',
  component: Button,
  parameters: {
    docs: {
      page: mdx,
    },
  },
} as Meta;

export const Variants: Story<ButtonProps> = () => {
  const sizes: ComponentSize[] = ['lg', 'md', 'sm'];
  return (
    <VerticalGroup>
      {allButtonFills.map((buttonFill) => (
        <VerticalGroup key={buttonFill}>
          <HorizontalGroup spacing="lg">
            {allButtonVariants.map((variant) => (
              <VerticalGroup spacing="lg" key={`${buttonFill}-${variant}`}>
                {sizes.map((size) => (
                  <Button variant={variant} fill={buttonFill} size={size} key={size}>
                    {variant} {size}
                  </Button>
                ))}
                <Button variant={variant} fill={buttonFill} disabled>
                  {variant} disabled
                </Button>
              </VerticalGroup>
            ))}
          </HorizontalGroup>
          <div style={{ padding: '20px 0', width: '100%' }} />
        </VerticalGroup>
      ))}
      <HorizontalGroup spacing="lg">
        <div>With icon and text</div>
        <Button icon="cloud" size="sm">
          Configure
        </Button>
        <Button icon="cloud">Configure</Button>
        <Button icon="cloud" size="lg">
          Configure
        </Button>
      </HorizontalGroup>
      <div />
      <HorizontalGroup spacing="lg">
        <div>With icon only</div>
        <Button icon="cloud" size="sm" />
        <Button icon="cloud" size="md" />
        <Button icon="cloud" size="lg" />
      </HorizontalGroup>
      <div />
      <Button icon="plus" fullWidth>
        Button with fullWidth
      </Button>
      <div />
      <HorizontalGroup spacing="lg">
        <div>Inside ButtonGroup</div>
        <ButtonGroup>
          <Button icon="sync">Run query</Button>
          <Button icon="angle-down" />
        </ButtonGroup>
      </HorizontalGroup>
      <Card heading="Button inside card">
        <Card.Actions>
          <>
            {allButtonVariants.map((variant) => (
              <Button variant={variant} key={variant}>
                {variant}
              </Button>
            ))}
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </>
        </Card.Actions>
      </Card>
    </VerticalGroup>
  );
};
