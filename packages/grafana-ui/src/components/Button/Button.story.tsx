import React from 'react';
import { storiesOf } from '@storybook/react';
import { Button, LinkButton } from './Button';
import { ButtonSize, ButtonVariant, ButtonProps } from './AbstractButton';
// @ts-ignore
import withPropsCombinations from 'react-storybook-addon-props-combinations';
import { action } from '@storybook/addon-actions';
import { ThemeableCombinationsRowRenderer } from '../../utils/storybook/CombinationsRowRenderer';

const ButtonStories = storiesOf('UI/Button', module);

const storyOf = (component: React.ComponentType<ButtonProps<any>>) => withPropsCombinations(
  (props: ButtonProps<HTMLButtonElement>) => {
    return React.createElement(component, {
      ...props,
      onClick: action('Button clicked'),
      children: 'Click, click!'
    });
  },
  {
    size: [ButtonSize.ExtraSmall, ButtonSize.Small, ButtonSize.Large, ButtonSize.ExtraLarge],
    variant: [ButtonVariant.Primary, ButtonVariant.Secondary, ButtonVariant.Danger],
  },
  {
    CombinationRenderer: ThemeableCombinationsRowRenderer
  }
);

ButtonStories.add('as button element', storyOf(Button));
ButtonStories.add('as link element', storyOf(LinkButton));
