import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { useStyles } from '../../themes';
import { Icon } from '../Icon/Icon';
import { DataLinkButton } from './DataLinkButton';
/**
 * @internal
 */
export function FieldLinkList(_a) {
    var links = _a.links;
    var styles = useStyles(getStyles);
    if (links.length === 1) {
        return React.createElement(DataLinkButton, { link: links[0] });
    }
    var externalLinks = links.filter(function (link) { return link.target === '_blank'; });
    var internalLinks = links.filter(function (link) { return link.target === '_self'; });
    return (React.createElement(React.Fragment, null,
        internalLinks.map(function (link, i) {
            return React.createElement(DataLinkButton, { key: i, link: link });
        }),
        React.createElement("div", { className: styles.wrapper },
            React.createElement("p", { className: styles.externalLinksHeading }, "External links"),
            externalLinks.map(function (link, i) { return (React.createElement("a", { key: i, href: link.href, target: link.target, className: styles.externalLink },
                React.createElement(Icon, { name: "external-link-alt" }),
                link.title)); }))));
}
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    flex-basis: 150px;\n    width: 100px;\n    margin-top: ", ";\n  "], ["\n    flex-basis: 150px;\n    width: 100px;\n    margin-top: ", ";\n  "])), theme.spacing.sm),
    externalLinksHeading: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    color: ", ";\n    font-weight: ", ";\n    font-size: ", ";\n    margin: 0;\n  "], ["\n    color: ", ";\n    font-weight: ", ";\n    font-size: ", ";\n    margin: 0;\n  "])), theme.colors.textWeak, theme.typography.weight.regular, theme.typography.size.sm),
    externalLink: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    color: ", ";\n    font-weight: ", ";\n    display: block;\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n\n    &:hover {\n      text-decoration: underline;\n    }\n\n    div {\n      margin-right: ", ";\n    }\n  "], ["\n    color: ", ";\n    font-weight: ", ";\n    display: block;\n    white-space: nowrap;\n    overflow: hidden;\n    text-overflow: ellipsis;\n\n    &:hover {\n      text-decoration: underline;\n    }\n\n    div {\n      margin-right: ", ";\n    }\n  "])), theme.colors.linkExternal, theme.typography.weight.regular, theme.spacing.sm),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=FieldLinkList.js.map