import { __rest } from "tslib";
import { cx } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { LinkTooltipCore } from '../../Elements/LinkTooltipCore';
import { getStyles } from './LabelCore.styles';
export const LabelCore = (_a) => {
    var { name, label, labelWrapperClassName, labelClassName, inputId, tooltipText, required = false } = _a, linkTooltipProps = __rest(_a, ["name", "label", "labelWrapperClassName", "labelClassName", "inputId", "tooltipText", "required"]);
    const styles = useStyles2(getStyles);
    return label ? (React.createElement("div", { className: cx(styles.labelWrapper, labelWrapperClassName) },
        React.createElement("label", { className: cx(styles.label, labelClassName), htmlFor: inputId, "data-testid": `${name}-field-label` },
            label,
            required ? ' *' : ''),
        tooltipText && React.createElement(LinkTooltipCore, Object.assign({ tooltipText: tooltipText }, linkTooltipProps)))) : null;
};
//# sourceMappingURL=LabelCore.js.map