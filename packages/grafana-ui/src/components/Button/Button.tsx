import React, { useContext } from 'react';
import { AbstractButton, ButtonProps, LinkButtonProps } from './AbstractButton';
import { ThemeContext } from '../../themes';

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
