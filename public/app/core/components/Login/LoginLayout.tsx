import { cx, css, keyframes } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, styleMixins } from '@grafana/ui';

import { Branding } from '../Branding/Branding';
import { BrandingSettings } from '../Branding/types';
import { Footer } from '../Footer/Footer';

interface InnerBoxProps {
  enterAnimation?: boolean;
}
export const InnerBox = ({ children, enterAnimation = true }: React.PropsWithChildren<InnerBoxProps>) => {
  const loginStyles = useStyles2(getLoginStyles);
  return <div className={cx(loginStyles.loginInnerBox, enterAnimation && loginStyles.enterAnimation)}>{children}</div>;
};

export interface LoginLayoutProps {
  /** Custom branding settings that can be used e.g. for previewing the Login page changes */
  branding?: BrandingSettings;
}

export const LoginLayout = ({ children, branding }: React.PropsWithChildren<LoginLayoutProps>) => {
  const loginStyles = useStyles2(getLoginStyles);
  const [startAnim, setStartAnim] = useState(false);
  const subTitle = branding?.loginSubtitle ?? Branding.GetLoginSubTitle();
  const loginTitle = branding?.loginTitle ?? Branding.LoginTitle;
  const loginBoxBackground = branding?.loginBoxBackground || Branding.LoginBoxBackground();
  const loginLogo = branding?.loginLogo;

  useEffect(() => setStartAnim(true), []);

  return (
    <Branding.LoginBackground
      className={cx(loginStyles.container, startAnim && loginStyles.loginAnim, branding?.loginBackground)}
    >
      <div className={cx(loginStyles.loginContent, loginBoxBackground, 'login-content-box')}>
        <div className={loginStyles.loginLogoWrapper}>
          <Branding.LoginLogo className={loginStyles.loginLogo} logo={loginLogo} />
          <div className={loginStyles.titleWrapper}>
            <h1 className={loginStyles.mainTitle}>{loginTitle}</h1>
            {subTitle && <h3 className={loginStyles.subTitle}>{subTitle}</h3>}
          </div>
        </div>
        <div className={loginStyles.loginOuterBox}>{children}</div>
      </div>
      <Footer customLinks={branding?.footerLinks} />
    </Branding.LoginBackground>
  );
};

const flyInAnimation = keyframes`
from{
  opacity: 0;
  transform: translate(-60px, 0px);
}

to{
  opacity: 1;
  transform: translate(0px, 0px);
}`;

export const getLoginStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      minHeight: '100%',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      minWidth: '100%',
      marginLeft: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    loginAnim: css`
      &:before {
        opacity: 1;
      }

      .login-content-box {
        opacity: 1;
      }
    `,
    submitButton: css`
      justify-content: center;
      width: 100%;
    `,
    loginLogo: css`
      width: 100%;
      max-width: 60px;
      margin-bottom: 15px;

      @media ${styleMixins.mediaUp(theme.v1.breakpoints.sm)} {
        max-width: 100px;
      }
    `,
    loginLogoWrapper: css`
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      padding: ${theme.spacing(3)};
    `,
    titleWrapper: css`
      text-align: center;
    `,
    mainTitle: css`
      font-size: 22px;

      @media ${styleMixins.mediaUp(theme.v1.breakpoints.sm)} {
        font-size: 32px;
      }
    `,
    subTitle: css`
      font-size: ${theme.typography.size.md};
      color: ${theme.colors.text.secondary};
    `,
    loginContent: css`
      max-width: 478px;
      width: calc(100% - 2rem);
      display: flex;
      align-items: stretch;
      flex-direction: column;
      position: relative;
      justify-content: flex-start;
      z-index: 1;
      min-height: 320px;
      border-radius: ${theme.shape.borderRadius(4)};
      padding: ${theme.spacing(2, 0)};
      opacity: 0;
      transition: opacity 0.5s ease-in-out;

      @media ${styleMixins.mediaUp(theme.v1.breakpoints.sm)} {
        min-height: 320px;
        justify-content: center;
      }
    `,
    loginOuterBox: css`
      display: flex;
      overflow-y: hidden;
      align-items: center;
      justify-content: center;
    `,
    loginInnerBox: css`
      padding: ${theme.spacing(2)};

      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex-grow: 1;
      max-width: 415px;
      width: 100%;
      transform: translate(0px, 0px);
      transition: 0.25s ease;
    `,
    enterAnimation: css`
      animation: ${flyInAnimation} ease-out 0.2s;
    `,
  };
};
