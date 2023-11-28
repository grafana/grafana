import { __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React from 'react';
import { Stack } from '@grafana/experimental';
import { Icon, useStyles2, Text } from '@grafana/ui';
const MetaText = (_a) => {
    var { children, icon, color = 'secondary' } = _a, rest = __rest(_a, ["children", "icon", "color"]);
    const styles = useStyles2(getStyles);
    const interactive = typeof rest.onClick === 'function';
    return (React.createElement("div", Object.assign({ className: cx({
            [styles.interactive]: interactive,
        }) }, rest),
        React.createElement(Text, { variant: "bodySmall", color: color },
            React.createElement(Stack, { direction: "row", alignItems: "center", gap: 0.5 },
                icon && React.createElement(Icon, { size: "sm", name: icon }),
                children))));
};
const getStyles = () => ({
    interactive: css `
    cursor: pointer;
  `,
});
export { MetaText };
//# sourceMappingURL=MetaText.js.map