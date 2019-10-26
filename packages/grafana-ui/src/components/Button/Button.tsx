import React, { useContext } from 'react';
import { AbstractButton } from './AbstractButton';
import { ThemeContext } from '../../themes';
import { ButtonProps, LinkButtonProps } from './types';

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
