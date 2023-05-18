import { css } from '@emotion/css';
import { StoryFn, Meta } from '@storybook/react';
import React from 'react';

import { useTheme2 } from '../../themes';
import { IconSize, IconName } from '../../types';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { HorizontalGroup, VerticalGroup } from '../Layout/Layout';

import { IconButton, IconButtonVariant, Props as IconButtonProps } from './IconButton';
import mdx from './IconButton.mdx';

interface ScenarioProps {
  background: 'canvas' | 'primary' | 'secondary';
}

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

export const Basic: StoryFn<typeof IconButton> = (args: IconButtonProps) => {
  return <IconButton {...args} />;
};

export const ExamplesSizes = () => {
  const theme = useTheme2();
  const sizes: IconSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
  const icons: IconName[] = ['search', 'trash-alt', 'arrow-left', 'times'];
  const variants: IconButtonVariant[] = ['primary', 'secondary', 'destructive'];

  const rowStyle = css`
    display: flex;
    gap: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(2)};
  `;

  return (
    <HorizontalGroup spacing="md">
      {variants.map((variant) => {
        return (
          <div key={variant}>
            <p>{variant}</p>
            {icons.map((icon) => {
              return (
                <div className={rowStyle} key={icon}>
                  {sizes.map((size) => (
                    <span key={icon + size}>
                      <IconButton name={icon} size={size} variant={variant} />
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
      <div>
        <p>disabled</p>
        {icons.map((icon) => (
          <div className={rowStyle} key={icon}>
            {sizes.map((size) => (
              <span key={icon + size}>
                <IconButton name={icon} size={size} disabled />
              </span>
            ))}
          </div>
        ))}
      </div>
    </HorizontalGroup>
  );
};

export const ExamplesBackground = () => {
  return (
    <div>
      <RenderBackgroundScenario background="canvas" />
      <RenderBackgroundScenario background="primary" />
      <RenderBackgroundScenario background="secondary" />
    </div>
  );
};

const RenderBackgroundScenario = ({ background }: ScenarioProps) => {
  const theme = useTheme2();
  const variants: IconButtonVariant[] = ['primary', 'secondary', 'destructive'];

  return (
    <div
      className={css`
        padding: 30px;
        background: ${theme.colors.background[background]};
      `}
    >
      <VerticalGroup spacing="md">
        <div>{background}</div>
        <div
          className={css`
            display: flex;
            gap: ${theme.spacing(2)};
          `}
        >
          {variants.map((variant) => {
            return <IconButton name="times" size="xl" variant={variant} key={variant} />;
          })}
          <IconButton name="times" size="xl" disabled />
        </div>
      </VerticalGroup>
    </div>
  );
};

export default meta;
