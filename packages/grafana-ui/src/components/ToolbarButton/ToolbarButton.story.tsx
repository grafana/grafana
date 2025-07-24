import { Meta, StoryFn } from '@storybook/react';

import { DashboardStoryCanvas } from '../../utils/storybook/DashboardStoryCanvas';
import { ButtonGroup } from '../Button/ButtonGroup';
import { Stack } from '../Layout/Stack/Stack';

import { ToolbarButton, ToolbarButtonVariant } from './ToolbarButton';
import mdx from './ToolbarButton.mdx';
import { ToolbarButtonRow } from './ToolbarButtonRow';

const meta: Meta<typeof ToolbarButton> = {
  title: 'Navigation/ToolbarButton',
  component: ToolbarButton,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['imgSrc', 'imgAlt', 'narrow'],
    },
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
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
      <Stack direction="column" gap={1.5}>
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
          <ToolbarButton variant="active" icon="clock-nine" tooltip="Time picker">
            2020-10-02
          </ToolbarButton>
          <ToolbarButton variant="active" icon="search-minus" />
        </ButtonGroup>
        <br />
        <ButtonGroup>
          <ToolbarButton variant="canvas" icon="sync" />
          <ToolbarButton variant="canvas" isOpen={false} narrow />
        </ButtonGroup>
        <br />
        Inside button group
        <Stack>
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
        </Stack>
      </Stack>
    </DashboardStoryCanvas>
  );
};

export default meta;
