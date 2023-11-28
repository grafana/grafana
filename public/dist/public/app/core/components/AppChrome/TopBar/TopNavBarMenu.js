import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React from 'react';
import { Menu, MenuItem, useStyles2 } from '@grafana/ui';
import { enrichWithInteractionTracking } from '../MegaMenu/utils';
export function TopNavBarMenu({ node: nodePlain }) {
    var _a;
    const styles = useStyles2(getStyles);
    const node = enrichWithInteractionTracking(cloneDeep(nodePlain), false);
    if (!node) {
        return null;
    }
    return (React.createElement(Menu, { header: 
        // this is needed to prevent bubbling the event to `Menu` and then closing when highlighting header text
        // see https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-static-element-interactions.md#case-the-event-handler-is-only-being-used-to-capture-bubbled-events
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        React.createElement("div", { onClick: (e) => e.stopPropagation(), className: styles.header },
            React.createElement("div", null, node.text),
            node.subTitle && React.createElement("div", { className: styles.subTitle }, node.subTitle)) }, (_a = node.children) === null || _a === void 0 ? void 0 : _a.map((item) => {
        return item.url ? (React.createElement(MenuItem, { url: item.url, label: item.text, icon: item.icon, target: item.target, key: item.id })) : (React.createElement(MenuItem, { icon: item.icon, onClick: item.onClick, label: item.text, key: item.id }));
    })));
}
const getStyles = (theme) => {
    return {
        header: css({
            fontSize: theme.typography.h5.fontSize,
            fontWeight: theme.typography.h5.fontWeight,
            padding: theme.spacing(0.5, 1),
            whiteSpace: 'nowrap',
        }),
        subTitle: css({
            color: theme.colors.text.secondary,
            fontSize: theme.typography.bodySmall.fontSize,
        }),
    };
};
//# sourceMappingURL=TopNavBarMenu.js.map