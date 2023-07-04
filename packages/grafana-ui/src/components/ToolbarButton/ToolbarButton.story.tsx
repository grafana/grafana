import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ButtonGroup } from '../Button';
import { HorizontalGroup, VerticalGroup } from '../Layout/Layout';

import { ToolbarButton, ToolbarButtonVariant } from './ToolbarButton';
import mdx from './ToolbarButton.mdx';
import { ToolbarButtonRow } from './ToolbarButtonRow';

const meta: Meta<typeof ToolbarButton> = {
  title: 'Buttons/ToolbarButton',
  component: ToolbarButton,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['imgSrc', 'imgAlt', 'narrow'],
    },
  },
  args: {
    variant: 'default',
    fullWidth: false,
    disabled: false,
    children: 'Just text',
    icon: 'cloud',
    isOpen: false,
    tooltip: 'This is a tooltip',
    isHighlighted: false,
    imgSrc: '',
    imgAlt: '',
  },
  argTypes: {
    variant: {
      control: {
        type: 'select',
      },
      options: ['default', 'primary', 'active', 'destructive'],
    },
    icon: {
      control: {
        type: 'select',
        options: ['sync', 'cloud'],
      },
    },
  },
};

export const BasicWithText: StoryFn<typeof ToolbarButton> = (args) => {
  return (
    <ToolbarButton
      variant={args.variant}
      disabled={args.disabled}
      fullWidth={args.fullWidth}
      icon={args.icon}
      tooltip={args.tooltip}
      isOpen={args.isOpen}
      isHighlighted={args.isHighlighted}
      imgSrc={args.imgSrc}
      imgAlt={args.imgAlt}
    >
      {args.children}
    </ToolbarButton>
  );
};
BasicWithText.args = {
  icon: undefined,
  iconOnly: false,
};

export const BasicWithIcon: StoryFn<typeof ToolbarButton> = (args) => {
  return (
    <ToolbarButton
      variant={args.variant}
      icon={args.icon}
      isOpen={args.isOpen}
      tooltip={args.tooltip}
      disabled={args.disabled}
      fullWidth={args.fullWidth}
      isHighlighted={args.isHighlighted}
      imgSrc={args.imgSrc}
      imgAlt={args.imgAlt}
    />
  );
};
BasicWithIcon.args = {
  iconOnly: true,
};

export const Examples: StoryFn<typeof ToolbarButton> = (args) => {
  const variants: ToolbarButtonVariant[] = ['default', 'canvas', 'active', 'primary', 'destructive'];

  return (
    <DashboardStoryCanvas>
      <VerticalGroup>
        Button states
        <ToolbarButtonRow>
          <ToolbarButton variant="canvas">Just text</ToolbarButton>
          <ToolbarButton variant="canvas" icon="sync" tooltip="Sync" />
          <ToolbarButton variant="canvas" imgSrc="./grafana_icon.svg">
            With imgSrc
          </ToolbarButton>
          <ToolbarButton variant="canvas" icon="cloud" isOpen={true}>
            isOpen
          </ToolbarButton>
          <ToolbarButton variant="canvas" icon="cloud" isOpen={false}>
            isOpen = false
          </ToolbarButton>
        </ToolbarButtonRow>
        <br />
        disabled
        <ToolbarButtonRow>
          <ToolbarButton variant="canvas" icon="sync" disabled>
            Disabled
          </ToolbarButton>
        </ToolbarButtonRow>
        <br />
        Variants
        <ToolbarButtonRow>
          {variants.map((variant) => (
            <ToolbarButton icon="sync" tooltip="Sync" variant={variant} key={variant}>
              {variant}
            </ToolbarButton>
          ))}
        </ToolbarButtonRow>
        <br />
        Wrapped in noSpacing ButtonGroup
        <ButtonGroup>
          <ToolbarButton variant="canvas" icon="clock-nine" tooltip="Time picker">
            2020-10-02
          </ToolbarButton>
          <ToolbarButton variant="canvas" icon="search-minus" />
        </ButtonGroup>
        <br />
        <ButtonGroup>
          <ToolbarButton variant="canvas" icon="sync" />
          <ToolbarButton variant="canvas" isOpen={false} narrow />
        </ButtonGroup>
        <br />
        Inside button group
        <HorizontalGroup>
          <ButtonGroup>
            <ToolbarButton variant="primary" icon="sync">
              Run query
            </ToolbarButton>
            <ToolbarButton isOpen={false} narrow variant="primary" />
          </ButtonGroup>
          <ButtonGroup>
            <ToolbarButton variant="destructive" icon="sync">
              Run query
            </ToolbarButton>
            <ToolbarButton isOpen={false} narrow variant="destructive" />
          </ButtonGroup>
        </HorizontalGroup>
      </VerticalGroup>
    </DashboardStoryCanvas>
  );
};

export default meta;
