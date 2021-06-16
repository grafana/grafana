import React, { FC, useEffect, useState } from 'react';
import { cx, css, keyframes } from '@emotion/css';
import { useStyles2, styleMixins } from '@grafana/ui';
import { Branding } from '../Branding/Branding';
import { GrafanaTheme2 } from '@grafana/data';
import { Footer } from '../Footer/Footer';

interface InnerBoxProps {
  enterAnimation?: boolean;
}
export const InnerBox: FC<InnerBoxProps> = ({ children, enterAnimation = true }) => {
  const loginStyles = useStyles2(getLoginStyles);
  return <div className={cx(loginStyles.loginInnerBox, enterAnimation && loginStyles.enterAnimation)}>{children}</div>;
};

export const LoginLayout: FC = ({ children }) => {
  const loginStyles = useStyles2(getLoginStyles);
  const subTitle = Branding.GetLoginSubTitle();
  const [startAnim, setStartAnim] = useState(false);

  useEffect(() => setStartAnim(true), []);

  return (
    <Branding.LoginBackground className={cx(loginStyles.container, startAnim && loginStyles.loginAnim)}>
      <div className={cx(loginStyles.loginContent, Branding.LoginBoxBackground(), 'login-content-box')}>
        <div className={loginStyles.loginLogoWrapper}>
          <Branding.LoginLogo className={loginStyles.loginLogo} />
          <div className={loginStyles.titleWrapper}>
            <h1 className={loginStyles.mainTitle}>{Branding.LoginTitle}</h1>
            {subTitle && <h3 className={loginStyles.subTitle}>{Branding.GetLoginSubTitle()}</h3>}
          </div>
        </div>
        <div className={loginStyles.loginOuterBox}>{children}</div>
      </div>
      <Footer />
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
  const bgColor = theme.isDark ? '#000' : theme.colors.background.canvas;

  return {
    container: css({
      minHeight: '100vh',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundColor: bgColor,
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
