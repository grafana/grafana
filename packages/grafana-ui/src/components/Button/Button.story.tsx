import { storiesOf } from '@storybook/react';
import { Button, LinkButton } from './Button';
// @ts-ignore
import withPropsCombinations from 'react-storybook-addon-props-combinations';
import { action } from '@storybook/addon-actions';
import { ThemeableCombinationsRowRenderer } from '../../utils/storybook/CombinationsRowRenderer';
import { boolean } from '@storybook/addon-knobs';
import { getIconKnob } from '../../utils/storybook/knobs';

const ButtonStories = storiesOf('General/Button', module);

const defaultProps = {
  onClick: [action('Button clicked')],
  children: ['Click click!'],
};

const variants = {
  size: ['xs', 'sm', 'md', 'lg'],
  variant: ['primary', 'secondary', 'danger', 'inverse', 'transparent', 'link'],
};
const combinationOptions = {
  CombinationRenderer: ThemeableCombinationsRowRenderer,
};

const renderButtonStory = (buttonComponent: typeof Button | typeof LinkButton) => {
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
  const icon = getIconKnob();
  return withPropsCombinations(
    Button,
    { ...variants, ...defaultProps, icon: [icon && `fa fa-${icon}`] },
    combinationOptions
  )();
});
