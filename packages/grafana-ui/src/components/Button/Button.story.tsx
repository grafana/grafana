import { storiesOf } from '@storybook/react';
import { Button, LinkButton } from './Button';
import { ButtonSize, ButtonVariant } from './AbstractButton';
// @ts-ignore
import withPropsCombinations from 'react-storybook-addon-props-combinations';
import { action } from '@storybook/addon-actions';
import { ThemeableCombinationsRowRenderer } from '../../utils/storybook/CombinationsRowRenderer';
import { select } from '@storybook/addon-knobs';

const ButtonStories = storiesOf('UI/Button', module);

const defaultProps = {
  onClick: [action('Button clicked')],
  children: ['Click, click!'],
};

const variants = {
  size: [ButtonSize.ExtraSmall, ButtonSize.Small, ButtonSize.Medium, ButtonSize.Large, ButtonSize.ExtraLarge],
  variant: [
    ButtonVariant.Primary,
    ButtonVariant.Secondary,
    ButtonVariant.Danger,
    ButtonVariant.Inverse,
    ButtonVariant.Transparent,
  ],
};
const combinationOptions = {
  CombinationRenderer: ThemeableCombinationsRowRenderer,
};

ButtonStories.add(
  'as button element',
  withPropsCombinations(Button, { ...variants, ...defaultProps }, combinationOptions)
);

ButtonStories.add(
  'as link element',
  withPropsCombinations(LinkButton, { ...variants, ...defaultProps }, combinationOptions)
);

ButtonStories.add('with icon', () => {
  const iconKnob = select(
    'Icon',
    {
      Plus: 'plus',
      User: 'user',
      Gear: 'gear',
    },
    'plus'
  );
  return withPropsCombinations(Button, { ...variants, ...defaultProps, icon: [iconKnob] }, combinationOptions)();
});

