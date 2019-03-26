import React, { useContext } from 'react';
import { AbstractButton, ButtonProps, ButtonSize, LinkButtonProps } from './AbstractButton';
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

const buttonFactory: <T>(renderAs: string, size: ButtonSize, displayName: string) => React.ComponentType<T> = (
  renderAs,
  size,
  displayName
) => {
  const ButtonComponent: React.FunctionComponent<any> = props => {
    const theme = useContext(ThemeContext);
    return <AbstractButton {...props} size={size} renderAs={renderAs} theme={theme} />;
  };
  ButtonComponent.displayName = displayName;

  return ButtonComponent;
};

export const Button: React.FunctionComponent<ButtonProps> = props => {
  const theme = useContext(ThemeContext);
  return <AbstractButton {...props} renderAs="button" theme={theme} />;
};
Button.displayName = 'Button';

export const LinkButton: React.FunctionComponent<LinkButtonProps> = props => {
  const theme = useContext(ThemeContext);
  return <AbstractButton {...props} renderAs="a" theme={theme} />;
};
LinkButton.displayName = 'LinkButton';

export const ExtraSmallButton = buttonFactory<ButtonProps>(
  'button',
  ButtonSize.ExtraSmall,
  `${getSizeNameComponentSegment(ButtonSize.ExtraSmall)}Button`
);
export const SmallButton = buttonFactory<ButtonProps>(
  'button',
  ButtonSize.Small,
  `${getSizeNameComponentSegment(ButtonSize.Small)}Button`
);
export const LargeButton = buttonFactory<ButtonProps>(
  'button',
  ButtonSize.Large,
  `${getSizeNameComponentSegment(ButtonSize.Large)}Button`
);
export const ExtraLargeButton = buttonFactory<ButtonProps>(
  'button',
  ButtonSize.ExtraLarge,
  `${getSizeNameComponentSegment(ButtonSize.ExtraLarge)}Button`
);

export const ExtraSmallLinkButton = buttonFactory<LinkButtonProps>(
  'a',
  ButtonSize.ExtraSmall,
  `${getSizeNameComponentSegment(ButtonSize.ExtraSmall)}LinkButton`
);
export const SmallLinkButton = buttonFactory<LinkButtonProps>(
  'a',
  ButtonSize.Small,
  `${getSizeNameComponentSegment(ButtonSize.Small)}LinkButton`
);
export const LargeLinkButton = buttonFactory<LinkButtonProps>(
  'a',
  ButtonSize.Large,
  `${getSizeNameComponentSegment(ButtonSize.Large)}LinkButton`
);
export const ExtraLargeLinkButton = buttonFactory<LinkButtonProps>(
  'a',
  ButtonSize.ExtraLarge,
  `${getSizeNameComponentSegment(ButtonSize.ExtraLarge)}LinkButton`
);
