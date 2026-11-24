import { type StoryFn } from '@storybook/react';
import { useEffect, useRef } from 'react';
import { action } from 'storybook/actions';

import { type ComponentSize } from '../../types/size';
import { Stack } from '../Layout/Stack/Stack';

import { allGradientButtonFills, GradientButton, type GradientButtonProps } from './GradientButton';
import mdx from './GradientButton.mdx';

const sizes: ComponentSize[] = ['lg', 'md', 'sm'];

export default {
  title: 'Inputs/GradientButton',
  component: GradientButton,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    size: {
      options: sizes,
    },
    fill: {
      control: 'select',
      options: allGradientButtonFills,
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

export const Basic: StoryFn<typeof GradientButton> = (args: GradientButtonProps) => (
  <GradientButton onClick={action('clicked button')} {...args} />
);
Basic.args = {
  children: 'Analyze with Assistant',
  icon: 'ai-sparkle',
  fill: 'outline',
  size: 'md',
};

export const Examples: StoryFn<typeof GradientButton> = () => {
  return (
    <Stack direction="column" gap={4}>
      {allGradientButtonFills.map((fill) => (
        <Stack direction="column" gap={2} key={fill}>
          <Stack alignItems="center" gap={2}>
            {sizes.map((size) => (
              <GradientButton fill={fill} icon="ai-sparkle" size={size} key={size}>
                {`fill="${fill}" ${size}`}
              </GradientButton>
            ))}
            {sizes.map((size) => (
              <GradientButton fill={fill} icon="ai-sparkle" size={size} tooltip="Analyze with Assistant" key={size} />
            ))}
          </Stack>
          <Stack alignItems="center" gap={2}>
            <GradientButton fill={fill} icon="ai-sparkle" aria-expanded="true">
              Expanded
            </GradientButton>
            <GradientButton fill={fill} icon="ai-sparkle" disabled>
              Disabled
            </GradientButton>
            <GradientButton fill={fill} icon="ai-sparkle" tooltip="Assistant is unavailable" disabled />
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
};
Examples.parameters = {
  docs: {
    description: {
      story:
        'The first row of each fill shows the sizes and icon-only buttons. Hover a button to see the hover state, which has the same background as the expanded state. The expanded state is set with `aria-expanded="true"`, for example by a `Dropdown` trigger.',
    },
  },
};

export const FocusVisible: StoryFn<typeof GradientButton> = () => {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <Stack alignItems="center" gap={2}>
      <GradientButton icon="ai-sparkle" ref={ref}>
        Analyze with Assistant
      </GradientButton>
      <GradientButton fill="solid" icon="ai-sparkle">
        Analyze with Assistant
      </GradientButton>
    </Stack>
  );
};
FocusVisible.storyName = 'Focus visible';
// Focusing on mount would scroll the docs page to this story
FocusVisible.tags = ['!autodocs'];
