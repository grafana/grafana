import { __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React, { useEffect } from 'react';
import { reportExperimentView } from '@grafana/runtime/src';
import { Button, Icon, LinkButton, useStyles2 } from '@grafana/ui';
export const UpgradeBox = (_a) => {
    var { featureName, className, children, text, featureId, eventVariant = '', size = 'md' } = _a, htmlProps = __rest(_a, ["featureName", "className", "children", "text", "featureId", "eventVariant", "size"]);
    const styles = useStyles2(getUpgradeBoxStyles, size);
    useEffect(() => {
        reportExperimentView(`feature-highlights-${featureId}`, 'test', eventVariant);
    }, [eventVariant, featureId]);
    return (React.createElement("div", Object.assign({ className: cx(styles.box, className) }, htmlProps),
        React.createElement(Icon, { name: 'rocket', className: styles.icon }),
        React.createElement("div", { className: styles.inner },
            React.createElement("p", { className: styles.text },
                "You\u2019ve discovered a Pro feature! ",
                text || `Get the Grafana Pro plan to access ${featureName}.`),
            React.createElement(LinkButton, { variant: "secondary", size: size, className: styles.button, href: "https://grafana.com/profile/org/subscription", target: "__blank", rel: "noopener noreferrer" }, "Upgrade"))));
};
const getUpgradeBoxStyles = (theme, size) => {
    const borderRadius = theme.shape.borderRadius(2);
    const fontBase = size === 'md' ? 'body' : 'bodySmall';
    return {
        box: css `
      display: flex;
      align-items: center;
      position: relative;
      border-radius: ${borderRadius};
      background: ${theme.colors.success.transparent};
      padding: ${theme.spacing(2)};
      color: ${theme.colors.success.text};
      font-size: ${theme.typography[fontBase].fontSize};
      text-align: left;
      line-height: 16px;
      margin: ${theme.spacing(0, 'auto', 3, 'auto')};
      max-width: ${theme.breakpoints.values.xxl}px;
      width: 100%;
    `,
        inner: css `
      display: flex;
      align-items: center;
      width: 100%;
      justify-content: space-between;
    `,
        text: css `
      margin: 0;
    `,
        button: css `
      background-color: ${theme.colors.success.main};
      font-weight: ${theme.typography.fontWeightLight};
      color: white;

      &:hover {
        background-color: ${theme.colors.success.main};
      }

      &:focus-visible {
        box-shadow: none;
        color: ${theme.colors.text.primary};
        outline: 2px solid ${theme.colors.primary.main};
      }
    `,
        icon: css `
      margin: ${theme.spacing(0.5, 1, 0.5, 0.5)};
    `,
    };
};
export const UpgradeContent = ({ listItems, image, featureUrl, featureName, description, caption, action, }) => {
    const styles = useStyles2(getUpgradeContentStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.content },
            React.createElement("h3", { className: styles.title },
                "Get started with ",
                featureName),
            description && React.createElement("h6", { className: styles.description }, description),
            React.createElement("ul", { className: styles.list }, listItems.map((item, index) => (React.createElement("li", { key: index },
                React.createElement(Icon, { name: 'check', size: 'xl', className: styles.icon }),
                " ",
                item)))),
            (action === null || action === void 0 ? void 0 : action.link) && (React.createElement(LinkButton, { variant: 'primary', href: action.link }, action.text)),
            (action === null || action === void 0 ? void 0 : action.onClick) && (React.createElement(Button, { variant: 'primary', onClick: action.onClick }, action.text)),
            featureUrl && (React.createElement(LinkButton, { fill: 'text', href: featureUrl, className: styles.link, target: "_blank", rel: "noreferrer noopener" }, "Learn more"))),
        React.createElement("div", { className: styles.media },
            React.createElement("img", { src: getImgUrl(image), alt: 'Feature screenshot' }),
            caption && React.createElement("p", { className: styles.caption }, caption))));
};
const getUpgradeContentStyles = (theme) => {
    return {
        container: css `
      display: flex;
      justify-content: space-between;
    `,
        content: css `
      width: 45%;
      margin-right: ${theme.spacing(4)};
    `,
        media: css `
      width: 55%;

      img {
        width: 100%;
      }
    `,
        title: css `
      color: ${theme.colors.text.maxContrast};
    `,
        description: css `
      color: ${theme.colors.text.primary};
      font-weight: ${theme.typography.fontWeightLight};
    `,
        list: css `
      list-style: none;
      margin: ${theme.spacing(4, 0, 2, 0)};

      li {
        display: flex;
        align-items: flex-start;
        color: ${theme.colors.text.primary};
        padding: ${theme.spacing(1, 0)};
      }
    `,
        icon: css `
      color: ${theme.colors.success.main};
      margin-right: ${theme.spacing(1)};
    `,
        link: css `
      margin-left: ${theme.spacing(2)};
    `,
        caption: css `
      font-weight: ${theme.typography.fontWeightLight};
      margin: ${theme.spacing(1, 0, 0)};
    `,
    };
};
export const UpgradeContentVertical = ({ featureName, description, featureUrl, image, }) => {
    const styles = useStyles2(getContentVerticalStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement("h3", { className: styles.title },
            "Get started with ",
            featureName),
        description && React.createElement("h6", { className: styles.description }, description),
        React.createElement(LinkButton, { fill: 'text', href: featureUrl, target: "_blank", rel: "noreferrer noopener" }, "Learn more"),
        React.createElement("div", { className: styles.media },
            React.createElement("img", { src: getImgUrl(image), alt: 'Feature screenshot' }))));
};
const getContentVerticalStyles = (theme) => {
    return {
        container: css `
      overflow: auto;
      height: 100%;
    `,
        title: css `
      color: ${theme.colors.text.maxContrast};
    `,
        description: css `
      color: ${theme.colors.text.primary};
      font-weight: ${theme.typography.fontWeightLight};
    `,
        media: css `
      width: 100%;
      margin-top: ${theme.spacing(2)};

      img {
        width: 100%;
      }
    `,
    };
};
const getImgUrl = (urlOrId) => {
    if (urlOrId.startsWith('http')) {
        return urlOrId;
    }
    return '/public/img/enterprise/highlights/' + urlOrId;
};
//# sourceMappingURL=UpgradeBox.js.map