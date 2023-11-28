import { css, cx } from '@emotion/css';
import React from 'react';
import { colorManipulator } from '@grafana/data';
import { useTheme2, styleMixins } from '@grafana/ui';
export const LoginLogo = ({ className, logo }) => {
    // return <img className={className} src={`${logo ? logo : 'public/img/grafana_icon.svg'}`} alt="Grafana" />;
    // @PERCONA
    return React.createElement("img", { className: className, src: `${logo ? logo : 'public/img/icons/mono/pmm-logo.svg'}`, alt: "PMM" });
};
const LoginBackground = ({ className, children }) => {
    const theme = useTheme2();
    const background = css `
    &:before {
      content: '';
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      top: 0;
      background: url(public/img/g8_login_${theme.isDark ? 'dark' : 'light'}.svg);
      background-position: top center;
      background-size: auto;
      background-repeat: no-repeat;

      opacity: 0;
      transition: opacity 3s ease-in-out;

      @media ${styleMixins.mediaUp(theme.v1.breakpoints.md)} {
        background-position: center;
        background-size: cover;
      }
    }
  `;
    return React.createElement("div", { className: cx(background, className) }, children);
};
const MenuLogo = ({ className }) => {
    // return <img className={className} src="public/img/grafana_icon.svg" alt="Grafana" />;
    // @PERCONA
    return React.createElement("img", { className: className, src: "public/img/pmm-app-rounded-icon.svg", alt: "PMM" });
};
const LoginBoxBackground = () => {
    const theme = useTheme2();
    return css `
    background: ${colorManipulator.alpha(theme.colors.background.primary, 0.7)};
    background-size: cover;
  `;
};
export class Branding {
}
Branding.LoginLogo = LoginLogo;
Branding.LoginBackground = LoginBackground;
Branding.MenuLogo = MenuLogo;
Branding.LoginBoxBackground = LoginBoxBackground;
// static AppTitle = 'Grafana';
// static LoginTitle = 'Welcome to Grafana';
// static HideEdition = false;
// static GetLoginSubTitle = (): null | string => {
//   return null;
// };
// @PERCONA
Branding.AppTitle = 'Percona Monitoring and Management';
Branding.LoginTitle = 'Percona Monitoring and Management';
Branding.GetLoginSubTitle = () => {
    const slogans = [
        "Don't get in the way of the data",
        'Your single pane of glass',
        'Built better together',
        'Democratising data',
    ];
    const count = slogans.length;
    return slogans[Math.floor(Math.random() * count)];
};
//# sourceMappingURL=Branding.js.map