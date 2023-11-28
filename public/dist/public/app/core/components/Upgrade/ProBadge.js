import { __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React, { useEffect } from 'react';
import { reportExperimentView } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
export const ProBadge = (_a) => {
    var { text = 'PRO', className, experimentId, eventVariant = '' } = _a, htmlProps = __rest(_a, ["text", "className", "experimentId", "eventVariant"]);
    const styles = useStyles2(getStyles);
    useEffect(() => {
        if (experimentId) {
            reportExperimentView(experimentId, 'test', eventVariant);
        }
    }, [experimentId, eventVariant]);
    return (React.createElement("span", Object.assign({ className: cx(styles.badge, className) }, htmlProps), text));
};
const getStyles = (theme) => {
    return {
        badge: css `
      margin-left: ${theme.spacing(1.25)};
      border-radius: ${theme.shape.borderRadius(5)};
      background-color: ${theme.colors.success.main};
      padding: ${theme.spacing(0.25, 0.75)};
      color: white; // use the same color for both themes
      font-weight: ${theme.typography.fontWeightMedium};
      font-size: ${theme.typography.pxToRem(10)};
    `,
    };
};
//# sourceMappingURL=ProBadge.js.map