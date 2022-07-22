import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ButtonGroup } from '../Button';

import { ToolbarButton } from './ToolbarButton';
import mdx from './ToolbarButton.mdx';
import { ToolbarButtonRow } from './ToolbarButtonRow';

const meta: ComponentMeta<typeof ToolbarButton> = {
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

export const BasicWithText: ComponentStory<typeof ToolbarButton> = (args) => {
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

export const BasicWithIcon: ComponentStory<typeof ToolbarButton> = (args) => {
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

export const List: ComponentStory<typeof ToolbarButton> = (args) => {
  return (
    <ToolbarButtonRow>
      <ToolbarButton variant={args.variant} iconOnly={false} isOpen={false}>
        Last 6 hours
      </ToolbarButton>
      <ButtonGroup>
        <ToolbarButton icon="search-minus" variant={args.variant} />
        <ToolbarButton icon="search-plus" variant={args.variant} />
      </ButtonGroup>
      <ToolbarButton icon="sync" isOpen={false} variant={args.variant} />
    </ToolbarButtonRow>
  );
};

export default meta;
