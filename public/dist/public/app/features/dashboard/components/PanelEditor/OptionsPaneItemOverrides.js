import { css } from '@emotion/css';
import React from 'react';
import { Tooltip, useStyles2 } from '@grafana/ui';
export function OptionsPaneItemOverrides({ overrides }) {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.wrapper }, overrides.map((override, index) => (React.createElement(Tooltip, { content: override.tooltip, key: index.toString(), placement: "top" },
        React.createElement("div", { "aria-label": override.description, className: styles[override.type] }))))));
}
const getStyles = (theme) => {
    const common = {
        width: 8,
        height: 8,
        borderRadius: theme.shape.radius.circle,
        marginLeft: theme.spacing(1),
        position: 'relative',
        top: '-1px',
    };
    return {
        wrapper: css({
            display: 'flex',
        }),
        rule: css(Object.assign(Object.assign({}, common), { backgroundColor: theme.colors.primary.main })),
        data: css(Object.assign(Object.assign({}, common), { backgroundColor: theme.colors.warning.main })),
    };
};
//# sourceMappingURL=OptionsPaneItemOverrides.js.map