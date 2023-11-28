import { __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { Button } from '@grafana/ui/src/components/Button';
export const ActionButton = (_a) => {
    var { className } = _a, restProps = __rest(_a, ["className"]);
    const styles = useStyles2(getStyle);
    return React.createElement(Button, Object.assign({ variant: "secondary", size: "xs", className: cx(styles.wrapper, className) }, restProps));
};
export const getStyle = (theme) => ({
    wrapper: css `
    height: 24px;
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
//# sourceMappingURL=ActionButton.js.map