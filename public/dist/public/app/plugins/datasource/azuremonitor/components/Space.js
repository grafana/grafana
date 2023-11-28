import { css, cx } from '@emotion/css';
import React from 'react';
import { stylesFactory, useTheme2 } from '@grafana/ui';
export const Space = (props) => {
    const theme = useTheme2();
    const styles = getStyles(theme, props);
    return React.createElement("span", { className: cx(styles.wrapper) });
};
Space.defaultProps = {
    v: 0,
    h: 0,
    layout: 'block',
};
const getStyles = stylesFactory((theme, props) => {
    var _a, _b;
    return ({
        wrapper: css([
            {
                paddingRight: theme.spacing((_a = props.h) !== null && _a !== void 0 ? _a : 0),
                paddingBottom: theme.spacing((_b = props.v) !== null && _b !== void 0 ? _b : 0),
            },
            props.layout === 'inline' && {
                display: 'inline-block',
            },
            props.layout === 'block' && {
                display: 'block',
            },
        ]),
    });
});
//# sourceMappingURL=Space.js.map