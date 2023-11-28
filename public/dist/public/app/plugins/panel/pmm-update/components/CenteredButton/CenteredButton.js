import { __rest } from "tslib";
import { cx } from '@emotion/css';
import React from 'react';
import { Button } from '@grafana/ui';
import * as styles from './CenteredButton.styles';
export const CenteredButton = (_a) => {
    var { children, className } = _a, props = __rest(_a, ["children", "className"]);
    return (React.createElement(Button, Object.assign({ className: cx(className, styles.centeredButton) }, props), children));
};
//# sourceMappingURL=CenteredButton.js.map