import { css } from '@emotion/css';
import { StoryFn, Meta } from '@storybook/react';

import { useTheme2 } from '../../themes/ThemeContext';
import { IconSize, IconName } from '../../types/icon';
import { Stack } from '../Layout/Stack/Stack';

import { BasePropsWithTooltip, IconButton, IconButtonVariant, Props as IconButtonProps } from './IconButton';
import mdx from './IconButton.mdx';

interface ScenarioProps {
  background: 'canvas' | 'primary' | 'secondary';
}

const defaultExcludes = ['ariaLabel', 'aria-label'];
const additionalExcludes = ['size', 'name', 'variant', 'iconType'];

const meta: Meta<typeof IconButton> = {
  title: 'Inputs/IconButton',
  component: IconButton,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: { exclude: defaultExcludes },
  },
  args: {
    name: 'apps',
    size: 'md',
    iconType: 'default',
    tooltip: 'sample tooltip message',
    tooltipPlacement: 'top',
    variant: 'secondary',
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

export const ExamplesSizes = (args: BasePropsWithTooltip) => {
  const theme = useTheme2();
  const sizes: IconSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
  const icons: IconName[] = ['search', 'trash-alt', 'arrow-left', 'times'];
  const variants: IconButtonVariant[] = ['primary', 'secondary', 'destructive'];

  const rowStyle = css({
    display: 'flex',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  });

  return (
    <Stack justifyContent="center">
      {variants.map((variant) => {
        return (
          <div
            key={variant}
            className={css({
              margin: `auto ${theme.spacing(1)}`,
            })}
          >
            <p>{variant}</p>
            {icons.map((icon) => {
              return (
                <div className={rowStyle} key={icon}>
                  {sizes.map((size) => (
                    <span key={icon + size}>
                      <IconButton name={icon} size={size} variant={variant} tooltip={args.tooltip} />
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
                <IconButton name={icon} size={size} tooltip={args.tooltip} disabled />
              </span>
            ))}
          </div>
        ))}
      </div>
    </Stack>
  );
};

ExamplesSizes.parameters = {
  controls: {
    exclude: [...defaultExcludes, ...additionalExcludes],
  },
};

export const ExamplesBackground = (args: BasePropsWithTooltip) => {
  const RenderBackgroundScenario = ({ background }: ScenarioProps) => {
    const theme = useTheme2();
    const variants: IconButtonVariant[] = ['primary', 'secondary', 'destructive'];

    return (
      <div
        className={css({
          padding: '30px',
          background: theme.colors.background[background],
        })}
      >
        <Stack direction="column" gap={2}>
          <div>{background}</div>
          <div
            className={css({
              display: 'flex',
              gap: theme.spacing(2),
            })}
          >
            {variants.map((variant) => {
              return <IconButton name="times" size="xl" variant={variant} key={variant} tooltip={args.tooltip} />;
            })}
            <IconButton name="times" size="xl" tooltip={args.tooltip} disabled />
          </div>
        </Stack>
      </div>
    );
  };

  return (
    <div>
      <RenderBackgroundScenario background="canvas" />
      <RenderBackgroundScenario background="primary" />
      <RenderBackgroundScenario background="secondary" />
    </div>
  );
};

ExamplesBackground.parameters = {
  controls: {
    exclude: [...defaultExcludes, ...additionalExcludes],
  },
};

export default meta;
