import { cx, css, keyframes } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { useStyles2, styleMixins } from '@grafana/ui';
import { Branding } from '../Branding/Branding';
import LoginFooter from '../Footer/LoginFooter';
export const InnerBox = ({ children, enterAnimation = true }) => {
    const loginStyles = useStyles2(getLoginStyles);
    return React.createElement("div", { className: cx(loginStyles.loginInnerBox, enterAnimation && loginStyles.enterAnimation) }, children);
};
export const LoginLayout = ({ children, branding, isChangingPassword }) => {
    var _a, _b;
    const loginStyles = useStyles2(getLoginStyles);
    const [startAnim, setStartAnim] = useState(false);
    const subTitle = (_a = branding === null || branding === void 0 ? void 0 : branding.loginSubtitle) !== null && _a !== void 0 ? _a : Branding.GetLoginSubTitle();
    const loginTitle = (_b = branding === null || branding === void 0 ? void 0 : branding.loginTitle) !== null && _b !== void 0 ? _b : Branding.LoginTitle;
    const loginBoxBackground = (branding === null || branding === void 0 ? void 0 : branding.loginBoxBackground) || Branding.LoginBoxBackground();
    const loginLogo = branding === null || branding === void 0 ? void 0 : branding.loginLogo;
    useEffect(() => setStartAnim(true), []);
    return (React.createElement(Branding.LoginBackground, { className: cx(loginStyles.container, startAnim && loginStyles.loginAnim, branding === null || branding === void 0 ? void 0 : branding.loginBackground) },
        React.createElement("div", { className: loginStyles.loginMain },
            React.createElement("div", { className: cx(loginStyles.loginContent, loginBoxBackground, 'login-content-box') },
                React.createElement("div", { className: loginStyles.loginLogoWrapper },
                    React.createElement(Branding.LoginLogo, { className: loginStyles.loginLogo, logo: loginLogo }),
                    React.createElement("div", { className: loginStyles.titleWrapper }, isChangingPassword ? (React.createElement("h1", { className: loginStyles.mainTitle }, "Update your password")) : (React.createElement(React.Fragment, null,
                        React.createElement("h1", { className: loginStyles.mainTitle }, loginTitle),
                        subTitle && React.createElement("h3", { className: loginStyles.subTitle }, subTitle))))),
                React.createElement("div", { className: loginStyles.loginOuterBox }, children))),
        React.createElement(LoginFooter, null)));
};
const flyInAnimation = keyframes `
from{
  opacity: 0;
  transform: translate(-60px, 0px);
}

to{
  opacity: 1;
  transform: translate(0px, 0px);
}`;
export const getLoginStyles = (theme) => {
    return {
        loginMain: css({
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '100%',
        }),
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
        loginAnim: css `
      &:before {
        opacity: 1;
      }

      .login-content-box {
        opacity: 1;
      }
    `,
        submitButton: css `
      justify-content: center;
      width: 100%;
    `,
        loginLogo: css `
      width: 100%;
      max-width: 60px;
      margin-bottom: 15px;

      @media ${styleMixins.mediaUp(theme.v1.breakpoints.sm)} {
        max-width: 100px;
      }
    `,
        loginLogoWrapper: css `
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      padding: ${theme.spacing(3)};
    `,
        titleWrapper: css `
      text-align: center;
    `,
        mainTitle: css `
      font-size: 22px;

      @media ${styleMixins.mediaUp(theme.v1.breakpoints.sm)} {
        font-size: 32px;
      }
    `,
        subTitle: css `
      font-size: ${theme.typography.size.md};
      color: ${theme.colors.text.secondary};
    `,
        loginContent: css `
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
        loginOuterBox: css `
      display: flex;
      overflow-y: hidden;
      align-items: center;
      justify-content: center;
    `,
        loginInnerBox: css `
      padding: ${theme.spacing(0, 2, 2, 2)};

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
        enterAnimation: css `
      animation: ${flyInAnimation} ease-out 0.2s;
    `,
    };
};
//# sourceMappingURL=LoginLayout.js.map