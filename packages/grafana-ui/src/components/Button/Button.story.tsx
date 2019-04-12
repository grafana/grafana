import { storiesOf } from '@storybook/react';
import { Button, LinkButton } from './Button';
import { ButtonSize, ButtonVariant, CommonButtonProps } from './AbstractButton';
// @ts-ignore
import withPropsCombinations from 'react-storybook-addon-props-combinations';
import { action } from '@storybook/addon-actions';
import { ThemeableCombinationsRowRenderer } from '../../utils/storybook/CombinationsRowRenderer';
import { select, boolean } from '@storybook/addon-knobs';

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

const renderButtonStory = (buttonComponent: React.ComponentType<CommonButtonProps>) => {
  const isDisabled = boolean('Disable button', false);
  return withPropsCombinations(
    buttonComponent,
    { ...variants, ...defaultProps, disabled: [isDisabled] },
    combinationOptions
  )();
};

ButtonStories.add('as button element', () => renderButtonStory(Button));

ButtonStories.add('as link element', () => renderButtonStory(LinkButton));

ButtonStories.add('with icon', () => {
  const iconKnob = select(
    'Icon',
    {
      Plus: 'fa fa-plus',
      User: 'fa fa-user',
      Gear: 'fa fa-gear',
      Annotation: 'gicon gicon-annotation',
    },
    'fa fa-plus'
  );
  return withPropsCombinations(Button, { ...variants, ...defaultProps, icon: [iconKnob] }, combinationOptions)();
});
