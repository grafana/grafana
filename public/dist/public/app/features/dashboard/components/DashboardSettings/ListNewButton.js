import { __rest } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { Button, useStyles2 } from '@grafana/ui';
export const ListNewButton = (_a) => {
    var { children } = _a, restProps = __rest(_a, ["children"]);
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.buttonWrapper },
        React.createElement(Button, Object.assign({ icon: "plus", variant: "secondary" }, restProps), children)));
};
const getStyles = (theme) => ({
    buttonWrapper: css `
    padding: ${theme.spacing(3)} 0;
  `,
});
//# sourceMappingURL=ListNewButton.js.map