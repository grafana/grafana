import { css } from '@emotion/css';
import { type StoryFn, type Meta } from '@storybook/react';

import { useTheme2 } from '../../themes/ThemeContext';
import { type IconSize, type IconName } from '../../types/icon';
import { Stack } from '../Layout/Stack/Stack';

import {
  type BasePropsWithTooltip,
  IconButton,
  type IconButtonVariant,
  type Props as IconButtonProps,
} from './IconButton';
import mdx from './IconButton.mdx';

interface ScenarioProps {
  background: 'canvas' | 'primary' | 'secondary';
  tooltip: BasePropsWithTooltip['tooltip'];
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

const RenderBackgroundScenario = ({ background, tooltip }: ScenarioProps) => {
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
            return <IconButton name="times" size="xl" variant={variant} key={variant} tooltip={tooltip} />;
          })}
          <IconButton name="times" size="xl" tooltip={tooltip} disabled />
        </div>
      </Stack>
    </div>
  );
};

export const ExamplesBackground = (args: BasePropsWithTooltip) => {
  return (
    <div>
      <RenderBackgroundScenario background="canvas" tooltip={args.tooltip} />
      <RenderBackgroundScenario background="primary" tooltip={args.tooltip} />
      <RenderBackgroundScenario background="secondary" tooltip={args.tooltip} />
    </div>
  );
};

ExamplesBackground.parameters = {
  controls: {
    exclude: [...defaultExcludes, ...additionalExcludes],
  },
};

export default meta;
