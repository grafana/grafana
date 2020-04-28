import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

export interface BrandComponentProps {
  className?: string;
  children?: JSX.Element | JSX.Element[];
}

const LoginLogo: FC<BrandComponentProps> = ({ className }) => {
  const maxSize = css`
    max-width: 150px;
  `;

  return (
    <>
      <img className={cx(className, maxSize)} src="public/img/grafana_icon.svg" alt="Grafana" />
    </>
  );
};

const LoginBackground: FC<BrandComponentProps> = ({ className, children }) => {
  const theme = useTheme();
  const background = css`
    background: url(public/img/login_background_${theme.isDark ? 'dark' : 'light'}.svg);
    background-size: cover;
  `;

  return <div className={cx(background, className)}>{children}</div>;
};

const MenuLogo: FC<BrandComponentProps> = ({ className }) => {
  return <img className={className} src="public/img/grafana_icon.svg" alt="Grafana" />;
};

export class Branding {
  static LoginLogo = LoginLogo;
  static LoginBackground = LoginBackground;
  static MenuLogo = MenuLogo;
  static AppTitle = 'Grafana';
  static LoginMainTitle = 'Welcome to Grafana';
  static LoginSubTtitle = 'Your single pane of glass';
  static LoginContentBoxBg = (theme: GrafanaTheme) => {
    return theme.isLight ? 'rgba(6, 42, 88, 0.65)' : 'rgba(6, 42, 88, 0.65)';
  };
}
