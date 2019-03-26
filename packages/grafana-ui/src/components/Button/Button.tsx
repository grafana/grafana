import React, { useContext } from 'react';
import { AbstractButton, ButtonProps, ButtonSize } from './AbstractButton';
import { ThemeContext } from '../../themes';

const getSizeNameComponentSegment = (size: ButtonSize) => {
  switch (size) {
    case ButtonSize.ExtraSmall:
      return 'ExtraSmall';
    case ButtonSize.Small:
      return 'Small';
    case ButtonSize.Large:
      return 'Large';
    case ButtonSize.ExtraLarge:
      return 'ExtraLarge';
    default:
      return 'Medium';
  }
};
const buttonFactory = (renderAs: string, size: ButtonSize, displayName: string) => {
  const ButtonComponent: React.FunctionComponent<ButtonProps<HTMLButtonElement>> = props => {
    const theme = useContext(ThemeContext);
    return <AbstractButton {...props} size={size} renderAs={renderAs} theme={theme} />;
  };
  ButtonComponent.displayName = displayName;

  return ButtonComponent;
};

export const Button: React.FunctionComponent<ButtonProps<HTMLButtonElement>> = props => {
  const theme = useContext(ThemeContext);
  return <AbstractButton {...props} renderAs="button" theme={theme} />;
};
Button.displayName = 'Button';

export const LinkButton: React.FunctionComponent<ButtonProps<HTMLAnchorElement>> = props => {
  const theme = useContext(ThemeContext);
  return <AbstractButton {...props} renderAs="a" theme={theme} />;
};
LinkButton.displayName = 'LinkButton';

export const ExtraSmallButton = buttonFactory(
  'button',
  ButtonSize.ExtraSmall,
  `${getSizeNameComponentSegment(ButtonSize.ExtraSmall)}Button`
);
export const SmallButton = buttonFactory(
  'button',
  ButtonSize.Small,
  `${getSizeNameComponentSegment(ButtonSize.Small)}Button`
);
export const LargeButton = buttonFactory(
  'button',
  ButtonSize.Large,
  `${getSizeNameComponentSegment(ButtonSize.Large)}Button`
);
export const ExtraLargeButton = buttonFactory(
  'button',
  ButtonSize.ExtraLarge,
  `${getSizeNameComponentSegment(ButtonSize.ExtraLarge)}Button`
);

export const ExtraSmallLinkButton = buttonFactory(
  'a',
  ButtonSize.ExtraSmall,
  `${getSizeNameComponentSegment(ButtonSize.ExtraSmall)}LinkButton`
);
export const SmallLinkButton = buttonFactory(
  'a',
  ButtonSize.Small,
  `${getSizeNameComponentSegment(ButtonSize.Small)}LinkButton`
);
export const LargeLinkButton = buttonFactory(
  'a',
  ButtonSize.Large,
  `${getSizeNameComponentSegment(ButtonSize.Large)}LinkButton`
);
export const ExtraLargeLinkButton = buttonFactory(
  'a',
  ButtonSize.ExtraLarge,
  `${getSizeNameComponentSegment(ButtonSize.ExtraLarge)}LinkButton`
);
