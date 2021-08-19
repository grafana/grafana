import React, { FC } from 'react';
import { css, cx } from '@emotion/css';
import { useTheme2, styleMixins } from '@grafana/ui';
import { colorManipulator } from '@grafana/data';

export interface BrandComponentProps {
  className?: string;
  children?: JSX.Element | JSX.Element[];
}

const LoginLogo: FC<BrandComponentProps> = ({ className }) => {
  return <img className={className} src="public/img/hnl_icon.svg" alt="Grafana" />;
};

const CwLogo: FC<BrandComponentProps> = ({ className }) => {
  const theme = useTheme2();

  const logo = css`
    &:before {
      content: '';
      position: absolute;
      left: 50%;
      top: 100px;
      height: 60px;
      width: 200px;
      background: url(public/img/cw_logo.svg);
      background-position: center;
      background-size: contain;
      background-repeat: no-repeat;
      opacity: 0;
      transition: opacity 3s ease-in-out;
      transform: translate(-50%);

      @media ${styleMixins.mediaUp(theme.v1.breakpoints.lg)} {
        top: 240px;
        left: 200px;
      }
    }
  `;

  return <div className={cx(logo, className)}></div>;
};

const CwSlogan: FC<BrandComponentProps> = ({ className }) => {
  const theme = useTheme2();

  const slogan = css`
    &:before {
      content: '';
      position: absolute;
      left: 50%;
      top: 190px;
      height: 120px;
      width: 300px;
      background: url(public/img/cw_slogan.png);
      background-position: center;
      background-size: contain;
      background-repeat: no-repeat;
      opacity: 0;
      transition: opacity 3s ease-in-out;
      visibility: hidden;

      @media ${styleMixins.mediaUp(theme.v1.breakpoints.lg)} {
        top: 300px;
        left: 100px;
        visibility: visible;
      }
    }
  `;

  return <div className={cx(slogan, className)}></div>;
};

const LoginBackground: FC<BrandComponentProps> = ({ className, children }) => {
  const theme = useTheme2();

  const background = css`
    &:before {
      content: '';
      position: absolute;
      left: 0;
      bottom: 0;
      height: 60%;
      width: 100%;
      background: url(public/img/energy_vector.svg);
      background-position: bottom;
      background-size: contain;
      background-repeat: no-repeat;
      border-bottom: 13px solid ${theme.colors.primary.main};
      opacity: 0;
      transition: opacity 3s ease-in-out;

      @media ${styleMixins.mediaUp(theme.v1.breakpoints.lg)} {
        left: -12%;
      }
    }
  `;

  return <div className={cx(background, className)}>{children}</div>;
};

const MenuLogo: FC<BrandComponentProps> = ({ className }) => {
  return <img className={className} src="public/img/grafana_icon.svg" alt="Grafana" />;
};

const LoginBoxBackground = () => {
  const theme = useTheme2();
  return css`
    background: ${colorManipulator.alpha(theme.colors.background.primary, 0.7)};
    background-size: cover;
  `;
};

export class Branding {
  static LoginLogo = LoginLogo;
  static LoginBackground = LoginBackground;
  static CwLogo = CwLogo;
  static CwSlogan = CwSlogan;
  static MenuLogo = MenuLogo;
  static LoginBoxBackground = LoginBoxBackground;
  static AppTitle = 'CoreWatts';
  static LoginTitle = '';
  static GetLoginSubTitle = (): null | string => {
    return null;
  };
}
