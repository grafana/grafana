import { storiesOf } from '@storybook/react';
import { Button, LinkButton } from './Button';
import { ButtonSize, ButtonVariant } from './AbstractButton';
// @ts-ignore
import withPropsCombinations from 'react-storybook-addon-props-combinations';
import { action } from '@storybook/addon-actions';
import { ThemeableCombinationsRowRenderer } from '../../utils/storybook/CombinationsRowRenderer';

const ButtonStories = storiesOf('UI/Button', module);

const defaultProps = {
  onClick: [action('Button clicked')],
  children: ['Click, click!'],
};

const variants = {
  size: [ButtonSize.ExtraSmall, ButtonSize.Small, ButtonSize.Large, ButtonSize.ExtraLarge],
  variant: [ButtonVariant.Primary, ButtonVariant.Secondary, ButtonVariant.Danger],
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
