import { __rest } from "tslib";
import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { useRef } from 'react';
import { Stack } from '@grafana/experimental';
import { Switch, useStyles2 } from '@grafana/ui';
export function QueryHeaderSwitch(_a) {
    var { label } = _a, inputProps = __rest(_a, ["label"]);
    const dashedLabel = label.replace(' ', '-');
    const switchIdRef = useRef(uniqueId(`switch-${dashedLabel}`));
    const styles = useStyles2(getStyles);
    return (React.createElement(Stack, { gap: 1 },
        React.createElement("label", { htmlFor: switchIdRef.current, className: styles.switchLabel }, label),
        React.createElement(Switch, Object.assign({}, inputProps, { id: switchIdRef.current }))));
}
const getStyles = (theme) => {
    return {
        switchLabel: css({
            color: theme.colors.text.secondary,
            cursor: 'pointer',
            fontSize: theme.typography.bodySmall.fontSize,
            '&:hover': {
                color: theme.colors.text.primary,
            },
        }),
    };
};
//# sourceMappingURL=QueryHeaderSwitch.js.map