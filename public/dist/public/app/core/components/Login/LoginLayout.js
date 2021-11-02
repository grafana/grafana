import { __makeTemplateObject, __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { cx, css, keyframes } from '@emotion/css';
import { useStyles2, styleMixins } from '@grafana/ui';
import { Branding } from '../Branding/Branding';
import { Footer } from '../Footer/Footer';
export var InnerBox = function (_a) {
    var children = _a.children, _b = _a.enterAnimation, enterAnimation = _b === void 0 ? true : _b;
    var loginStyles = useStyles2(getLoginStyles);
    return React.createElement("div", { className: cx(loginStyles.loginInnerBox, enterAnimation && loginStyles.enterAnimation) }, children);
};
export var LoginLayout = function (_a) {
    var children = _a.children;
    var loginStyles = useStyles2(getLoginStyles);
    var subTitle = Branding.GetLoginSubTitle();
    var _b = __read(useState(false), 2), startAnim = _b[0], setStartAnim = _b[1];
    useEffect(function () { return setStartAnim(true); }, []);
    return (React.createElement(Branding.LoginBackground, { className: cx(loginStyles.container, startAnim && loginStyles.loginAnim) },
        React.createElement("div", { className: cx(loginStyles.loginContent, Branding.LoginBoxBackground(), 'login-content-box') },
            React.createElement("div", { className: loginStyles.loginLogoWrapper },
                React.createElement(Branding.LoginLogo, { className: loginStyles.loginLogo }),
                React.createElement("div", { className: loginStyles.titleWrapper },
                    React.createElement("h1", { className: loginStyles.mainTitle }, Branding.LoginTitle),
                    subTitle && React.createElement("h3", { className: loginStyles.subTitle }, Branding.GetLoginSubTitle()))),
            React.createElement("div", { className: loginStyles.loginOuterBox }, children)),
        React.createElement(Footer, null)));
};
var flyInAnimation = keyframes(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\nfrom{\n  opacity: 0;\n  transform: translate(-60px, 0px);\n}\n\nto{\n  opacity: 1;\n  transform: translate(0px, 0px);\n}"], ["\nfrom{\n  opacity: 0;\n  transform: translate(-60px, 0px);\n}\n\nto{\n  opacity: 1;\n  transform: translate(0px, 0px);\n}"])));
export var getLoginStyles = function (theme) {
    var bgColor = theme.isDark ? '#000' : theme.colors.background.canvas;
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
        loginAnim: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      &:before {\n        opacity: 1;\n      }\n\n      .login-content-box {\n        opacity: 1;\n      }\n    "], ["\n      &:before {\n        opacity: 1;\n      }\n\n      .login-content-box {\n        opacity: 1;\n      }\n    "]))),
        submitButton: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      justify-content: center;\n      width: 100%;\n    "], ["\n      justify-content: center;\n      width: 100%;\n    "]))),
        loginLogo: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      width: 100%;\n      max-width: 60px;\n      margin-bottom: 15px;\n\n      @media ", " {\n        max-width: 100px;\n      }\n    "], ["\n      width: 100%;\n      max-width: 60px;\n      margin-bottom: 15px;\n\n      @media ", " {\n        max-width: 100px;\n      }\n    "])), styleMixins.mediaUp(theme.v1.breakpoints.sm)),
        loginLogoWrapper: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      flex-direction: column;\n      padding: ", ";\n    "], ["\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      flex-direction: column;\n      padding: ", ";\n    "])), theme.spacing(3)),
        titleWrapper: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n      text-align: center;\n    "], ["\n      text-align: center;\n    "]))),
        mainTitle: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n      font-size: 22px;\n\n      @media ", " {\n        font-size: 32px;\n      }\n    "], ["\n      font-size: 22px;\n\n      @media ", " {\n        font-size: 32px;\n      }\n    "])), styleMixins.mediaUp(theme.v1.breakpoints.sm)),
        subTitle: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n      font-size: ", ";\n      color: ", ";\n    "], ["\n      font-size: ", ";\n      color: ", ";\n    "])), theme.typography.size.md, theme.colors.text.secondary),
        loginContent: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n      max-width: 478px;\n      width: calc(100% - 2rem);\n      display: flex;\n      align-items: stretch;\n      flex-direction: column;\n      position: relative;\n      justify-content: flex-start;\n      z-index: 1;\n      min-height: 320px;\n      border-radius: ", ";\n      padding: ", ";\n      opacity: 0;\n      transition: opacity 0.5s ease-in-out;\n\n      @media ", " {\n        min-height: 320px;\n        justify-content: center;\n      }\n    "], ["\n      max-width: 478px;\n      width: calc(100% - 2rem);\n      display: flex;\n      align-items: stretch;\n      flex-direction: column;\n      position: relative;\n      justify-content: flex-start;\n      z-index: 1;\n      min-height: 320px;\n      border-radius: ", ";\n      padding: ", ";\n      opacity: 0;\n      transition: opacity 0.5s ease-in-out;\n\n      @media ", " {\n        min-height: 320px;\n        justify-content: center;\n      }\n    "])), theme.shape.borderRadius(4), theme.spacing(2, 0), styleMixins.mediaUp(theme.v1.breakpoints.sm)),
        loginOuterBox: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n      display: flex;\n      overflow-y: hidden;\n      align-items: center;\n      justify-content: center;\n    "], ["\n      display: flex;\n      overflow-y: hidden;\n      align-items: center;\n      justify-content: center;\n    "]))),
        loginInnerBox: css(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n      padding: ", ";\n\n      display: flex;\n      flex-direction: column;\n      align-items: center;\n      justify-content: center;\n      flex-grow: 1;\n      max-width: 415px;\n      width: 100%;\n      transform: translate(0px, 0px);\n      transition: 0.25s ease;\n    "], ["\n      padding: ", ";\n\n      display: flex;\n      flex-direction: column;\n      align-items: center;\n      justify-content: center;\n      flex-grow: 1;\n      max-width: 415px;\n      width: 100%;\n      transform: translate(0px, 0px);\n      transition: 0.25s ease;\n    "])), theme.spacing(2)),
        enterAnimation: css(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\n      animation: ", " ease-out 0.2s;\n    "], ["\n      animation: ", " ease-out 0.2s;\n    "])), flyInAnimation),
    };
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12;
//# sourceMappingURL=LoginLayout.js.map