import { css } from '@emotion/css';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Button, CallToActionCard, Icon, LinkButton } from '@grafana/ui';
const ctaStyle = css `
  text-align: center;
`;
const infoBoxStyles = css `
  max-width: 700px;
  margin: 0 auto;
`;
const EmptyListCTA = ({ title, buttonIcon, buttonLink, buttonTitle, buttonDisabled, onClick, proTip, proTipLink, proTipLinkTitle, proTipTarget, infoBox, infoBoxTitle, }) => {
    const footer = () => {
        return (React.createElement(React.Fragment, null,
            proTip ? (React.createElement("span", { key: "proTipFooter" },
                React.createElement(Icon, { name: "rocket" }),
                React.createElement(React.Fragment, null,
                    " ProTip: ",
                    proTip,
                    " "),
                proTipLink && (React.createElement("a", { href: proTipLink, target: proTipTarget, className: "text-link" }, proTipLinkTitle)))) : (''),
            infoBox ? (React.createElement("div", { key: "infoBoxHtml", className: `grafana-info-box ${infoBoxStyles}` },
                infoBoxTitle && React.createElement("h5", null, infoBoxTitle),
                React.createElement("div", { dangerouslySetInnerHTML: infoBox }))) : ('')));
    };
    const ctaElementClassName = !footer()
        ? css `
        margin-bottom: 20px;
      `
        : '';
    const ButtonEl = buttonLink ? LinkButton : Button;
    const ctaElement = (React.createElement(ButtonEl, { size: "lg", onClick: onClick, href: buttonLink, icon: buttonIcon, className: ctaElementClassName, "data-testid": selectors.components.CallToActionCard.buttonV2(buttonTitle), disabled: buttonDisabled }, buttonTitle));
    return React.createElement(CallToActionCard, { className: ctaStyle, message: title, footer: footer(), callToActionElement: ctaElement });
};
export default EmptyListCTA;
//# sourceMappingURL=EmptyListCTA.js.map