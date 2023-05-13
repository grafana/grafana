import { css } from '@emotion/css';
import { StoryFn, Meta } from '@storybook/react';
import React from 'react';

import { useTheme2 } from '../../themes';
import { IconSize, IconName } from '../../types';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { VerticalGroup } from '../Layout/Layout';

import { IconButton, IconButtonVariant, Props as IconButtonProps } from './IconButton';
import mdx from './IconButton.mdx';

const meta: Meta<typeof IconButton> = {
  title: 'Buttons/IconButton',
  component: IconButton,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
  args: {
    name: 'apps',
    size: 'md',
    iconType: 'default',
    tooltip: 'sample tooltip message',
    tooltipPlacement: 'top',
    variant: 'secondary',
    ariaLabel: 'sample aria-label content',
  },
  argTypes: {
    tooltip: {
      control: 'text',
    },
  },
};

export const Examples = () => {
  return (
    <div>
      <RenderScenario background="canvas" />
      <RenderScenario background="primary" />
      <RenderScenario background="secondary" />
    </div>
  );
};

export const Basic: StoryFn<typeof IconButton> = (args: IconButtonProps) => {
  return <IconButton {...args} />;
};

interface ScenarioProps {
  background: 'canvas' | 'primary' | 'secondary';
}

const RenderScenario = ({ background }: ScenarioProps) => {
  const theme = useTheme2();
  const sizes: IconSize[] = ['sm', 'md', 'lg', 'xl', 'xxl'];
  const icons: IconName[] = ['search', 'trash-alt', 'arrow-left', 'times'];
  const variants: IconButtonVariant[] = ['secondary', 'primary', 'destructive'];

  return (
    <div
      className={css`
        padding: 30px;
        background: ${theme.colors.background[background]};
        button {
          margin-right: 8px;
          margin-left: 8px;
          margin-bottom: 8px;
        }
      `}
    >
      <VerticalGroup spacing="md">
        <div>{background}</div>
        {variants.map((variant) => {
          return (
            <div key={variant}>
              {icons.map((icon) => {
                return sizes.map((size) => (
                  <span key={icon + size}>
                    <IconButton name={icon} size={size} variant={variant} />
                  </span>
                ));
              })}
            </div>
          );
        })}
      </VerticalGroup>
    </div>
  );
};

export default meta;
