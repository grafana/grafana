import { __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React from 'react';
import { Legend, useStyles2 } from '@grafana/ui';
export function VariableLegend(_a) {
    var { className } = _a, rest = __rest(_a, ["className"]);
    const styles = useStyles2(getStyles);
    return React.createElement(Legend, Object.assign({}, rest, { className: cx(styles.legend, className) }));
}
function getStyles(theme) {
    return {
        legend: css({
            marginTop: theme.spacing(3),
            marginBottom: theme.spacing(1),
        }),
    };
}
//# sourceMappingURL=VariableLegend.js.map