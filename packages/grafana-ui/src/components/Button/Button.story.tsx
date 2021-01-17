import React from 'react';
import { Story } from '@storybook/react';
import { Button, ButtonProps, ButtonVariant } from './Button';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { iconOptions } from '../../utils/storybook/knobs';
import mdx from './Button.mdx';
import { useTheme } from '../../themes/ThemeContext';
import { HorizontalGroup, VerticalGroup } from '../Layout/Layout';
import { ToolbarButtonGroup } from '../ToolbarButton/ToolbarButtonGroup';
import { ComponentSize } from '../../types/size';

export default {
  title: 'Buttons/Button',
  component: Button,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  argTypes: {
    variant: { control: { type: 'select', options: ['primary', 'secondary', 'destructive', 'link'] } },
    size: { control: { type: 'select', options: ['sm', 'md', 'lg'] } },
    icon: { control: { type: 'select', options: iconOptions } },
    css: { control: { disable: true } },
    className: { control: { disable: true } },
  },
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disabled: true,
    },
  },
};

export const Variants: Story<ButtonProps> = ({ children, ...args }) => {
  const sizes: ComponentSize[] = ['lg', 'md', 'sm'];
  const variants: ButtonVariant[] = ['primary', 'secondary', 'destructive', 'link'];

  return (
    <HorizontalGroup spacing="lg">
      {variants.map(variant => (
        <VerticalGroup spacing="lg" key={variant}>
          {sizes.map(size => (
            <Button variant={variant} size={size} key={size}>
              {variant} {size}
            </Button>
          ))}
        </VerticalGroup>
      ))}
    </HorizontalGroup>
  );
};

// export const ToolbarButton = () => {
//   const theme = useTheme();

//   return (
//     <div style={{ background: theme.colors.dashboardBg, padding: '32px' }}>
//       <VerticalGroup>
//         Wrapped in normal ToolbarButtonGroup (md spacing)
//         <ToolbarButtonGroup>
//           <Button variant="toolbar">Just text</Button>
//         </ToolbarButtonGroup>
//       </VerticalGroup>
//     </div>
//   );
// };
