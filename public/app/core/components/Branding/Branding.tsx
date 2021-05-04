import React, { FC } from 'react';
import { css, cx } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';
import { colorManipulator } from '@grafana/data';

export interface BrandComponentProps {
  className?: string;
  children?: JSX.Element | JSX.Element[];
}

const LoginLogo: FC<BrandComponentProps> = ({ className }) => {
  return <img className={className} src="public/img/grafana_icon.svg" alt="Grafana" />;
};

const LoginBackground: FC<BrandComponentProps> = ({ className, children }) => {
  const theme = useTheme2();
  const background = css`
    background: url(public/img/g8_login_${theme.isDark ? 'dark' : 'light'}.svg);
    background-size: cover;
  `;

  return <div className={cx(background, className)}>{children}</div>;
};

const MenuLogo: FC<BrandComponentProps> = ({ className }) => {
  return <img className={className} src="public/img/grafana_icon.svg" alt="Grafana" />;
};

const LoginBoxBackground = () => {
  const theme = useTheme2();
  const color = theme.isLight ? 'rgba(6, 30, 200, 0.1 )' : colorManipulator.alpha(theme.colors.background.primary, 0.7);

  return css`
    background: ${color};
    background-size: cover;
  `;
};

export class Branding {
  static LoginLogo = LoginLogo;
  static LoginBackground = LoginBackground;
  static MenuLogo = MenuLogo;
  static LoginBoxBackground = LoginBoxBackground;
  static AppTitle = 'Grafana';
  static LoginTitle = 'Welcome to Grafana';
  static GetLoginSubTitle = () => {
    return null;
  };
}
