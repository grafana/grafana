import React, { FC } from 'react';
import { cx, css, keyframes } from 'emotion';
import { useStyles } from '@grafana/ui';
import { Branding } from '../Branding/Branding';
import { GrafanaTheme } from '@grafana/data';
import { Footer } from '../Footer/Footer';

interface InnerBoxProps {
  enterAnimation?: boolean;
}
export const InnerBox: FC<InnerBoxProps> = ({ children, enterAnimation = true }) => {
  const loginStyles = useStyles(getLoginStyles);
  return <div className={cx(loginStyles.loginInnerBox, enterAnimation && loginStyles.enterAnimation)}>{children}</div>;
};

export const LoginLayout: FC = ({ children }) => {
  const loginStyles = useStyles(getLoginStyles);
  return (
    <Branding.LoginBackground className={loginStyles.container}>
      <div className={cx(loginStyles.loginContent, Branding.LoginBoxBackground())}>
        <div className={loginStyles.loginLogoWrapper}>
          <Branding.LoginLogo className={loginStyles.loginLogo} />
          <div className={loginStyles.titleWrapper}>
            <h1 className={loginStyles.mainTitle}>{Branding.LoginTitle}</h1>
            <h3 className={loginStyles.subTitle}>{Branding.GetLoginSubTitle()}</h3>
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

export const getLoginStyles = (theme: GrafanaTheme) => {
  const bgColor = theme.isDark ? theme.palette.black : theme.palette.white;
  return {
    container: css`
      min-height: 100vh;
      background-position: center;
      background-repeat: no-repeat;
      background-color: ${bgColor};
      min-width: 100%;
      margin-left: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `,
    submitButton: css`
      justify-content: center;
      width: 100%;
    `,
    loginLogo: css`
      width: 100%;
      max-width: 100px;
      margin-bottom: 15px;
    `,
    loginLogoWrapper: css`
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      padding: ${theme.spacing.lg};
    `,
    titleWrapper: css`
      text-align: center;
    `,
    mainTitle: css`
      font-size: 32px;
    `,
    subTitle: css`
      font-size: ${theme.typography.size.md};
      color: ${theme.colors.textSemiWeak};
    `,
    loginContent: css`
      max-width: 550px;
      width: 100%;
      display: flex;
      align-items: stretch;
      flex-direction: column;
      position: relative;
      justify-content: center;
      z-index: 1;
      min-height: 320px;
      border-radius: 3px;
      padding: 20px 0;
    `,
    loginOuterBox: css`
      display: flex;
      overflow-y: hidden;
      align-items: center;
      justify-content: center;
    `,
    loginInnerBox: css`
      padding: ${theme.spacing.xl};
      @media (max-width: 320px) {
        padding: ${theme.spacing.lg};
      }
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
