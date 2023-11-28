import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export function Stack(props) {
    const styles = useStyles2(getStyles, props);
    return React.createElement("div", { className: styles.root }, props.children);
}
const getStyles = (theme, props) => {
    var _a, _b, _c;
    return ({
        root: css({
            display: 'flex',
            flexDirection: (_a = props.direction) !== null && _a !== void 0 ? _a : 'row',
            flexWrap: ((_b = props.wrap) !== null && _b !== void 0 ? _b : true) ? 'wrap' : undefined,
            alignItems: props.alignItems,
            gap: theme.spacing((_c = props.gap) !== null && _c !== void 0 ? _c : 2),
            flexGrow: props.flexGrow,
        }),
    });
};
//# sourceMappingURL=Stack.js.map