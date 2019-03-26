import React, { useContext } from 'react';
import { AbstractButton, ButtonProps } from './AbstractButton';
import { ThemeContext } from '../../themes';

export const Button: React.FunctionComponent<ButtonProps<HTMLButtonElement>> = (props) => {
  const theme = useContext(ThemeContext);
  return <AbstractButton {...props} renderAs="button" theme={theme} />;
};
Button.displayName = "Button";

export const LinkButton: React.FunctionComponent<ButtonProps<HTMLAnchorElement>> = (props) => {
  const theme = useContext(ThemeContext);
  return <AbstractButton {...props} renderAs="a" theme={theme} />;
};
LinkButton.displayName = "LinkButton";
