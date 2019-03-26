import React, { useContext } from 'react';
import { AbstractButton, ButtonProps } from './AbstractButton';
import { ThemeContext } from '../../themes';

export const Button = (props: ButtonProps<HTMLButtonElement>) => {
  const theme = useContext(ThemeContext);

  return <AbstractButton {...props} renderAs="button" theme={theme} />;
};

export const LinkButton = (props: ButtonProps<HTMLButtonElement>) => {
  const theme = useContext(ThemeContext);
  return <AbstractButton {...props} renderAs="a" theme={theme} />;
};
