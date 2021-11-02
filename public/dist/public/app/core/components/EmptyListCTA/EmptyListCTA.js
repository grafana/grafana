import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { CallToActionCard, Icon, LinkButton } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
var ctaStyle = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  text-align: center;\n"], ["\n  text-align: center;\n"])));
var infoBoxStyles = css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n  max-width: 700px;\n  margin: 0 auto;\n"], ["\n  max-width: 700px;\n  margin: 0 auto;\n"])));
var EmptyListCTA = function (_a) {
    var title = _a.title, buttonIcon = _a.buttonIcon, buttonLink = _a.buttonLink, buttonTitle = _a.buttonTitle, buttonDisabled = _a.buttonDisabled, onClick = _a.onClick, proTip = _a.proTip, proTipLink = _a.proTipLink, proTipLinkTitle = _a.proTipLinkTitle, proTipTarget = _a.proTipTarget, infoBox = _a.infoBox, infoBoxTitle = _a.infoBoxTitle;
    var footer = function () {
        return (React.createElement(React.Fragment, null,
            proTip ? (React.createElement("span", { key: "proTipFooter" },
                React.createElement(Icon, { name: "rocket" }),
                React.createElement(React.Fragment, null,
                    " ProTip: ",
                    proTip,
                    " "),
                proTipLink && (React.createElement("a", { href: proTipLink, target: proTipTarget, className: "text-link" }, proTipLinkTitle)))) : (''),
            infoBox ? (React.createElement("div", { key: "infoBoxHtml", className: "grafana-info-box " + infoBoxStyles },
                infoBoxTitle && React.createElement("h5", null, infoBoxTitle),
                React.createElement("div", { dangerouslySetInnerHTML: infoBox }))) : ('')));
    };
    var ctaElementClassName = !footer()
        ? css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        margin-bottom: 20px;\n      "], ["\n        margin-bottom: 20px;\n      "]))) : '';
    var ctaElement = (React.createElement(LinkButton, { size: "lg", onClick: onClick, href: buttonLink, icon: buttonIcon, className: ctaElementClassName, "aria-label": selectors.components.CallToActionCard.button(buttonTitle), disabled: buttonDisabled }, buttonTitle));
    return React.createElement(CallToActionCard, { className: ctaStyle, message: title, footer: footer(), callToActionElement: ctaElement });
};
export default EmptyListCTA;
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=EmptyListCTA.js.map