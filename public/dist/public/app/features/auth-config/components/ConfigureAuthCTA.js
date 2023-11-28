import { css } from '@emotion/css';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { CallToActionCard, LinkButton, useStyles2 } from '@grafana/ui';
const ConfigureAuthCTA = ({ title, buttonIcon, buttonLink, buttonTitle, buttonDisabled, description, onClick, }) => {
    const styles = useStyles2(getStyles);
    const footer = description ? React.createElement("span", { key: "proTipFooter" }, description) : '';
    const ctaElementClassName = !description ? styles.button : '';
    const ctaElement = (React.createElement(LinkButton, { size: "lg", href: buttonLink, icon: buttonIcon, className: ctaElementClassName, "data-testid": selectors.components.CallToActionCard.buttonV2(buttonTitle), disabled: buttonDisabled, onClick: () => onClick && onClick() }, buttonTitle));
    return React.createElement(CallToActionCard, { className: styles.cta, message: title, footer: footer, callToActionElement: ctaElement });
};
const getStyles = (theme) => {
    return {
        cta: css `
      text-align: center;
    `,
        button: css `
      margin-bottom: ${theme.spacing(2.5)};
    `,
    };
};
export default ConfigureAuthCTA;
//# sourceMappingURL=ConfigureAuthCTA.js.map