import React, { useContext } from 'react';
import { AbstractButton, ButtonProps } from '../Button/AbstractButton';
import { ThemeContext } from '../../themes';

export const Button: React.FunctionComponent<ButtonProps> = props => {
  const theme = useContext(ThemeContext);
  return <AbstractButton {...props} renderAs="button" theme={theme} />;
};
