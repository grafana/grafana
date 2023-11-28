import { __rest } from "tslib";
import { cx } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { LabelCore } from '../../Form/LabelCore';
import { getStyles } from './Checkbox.styles';
export const BaseCheckbox = (_a) => {
    var { name, inputId = `input-${name}-id`, fieldClassName, label, touched, error, tooltipText = '', tooltipLink, tooltipLinkText, tooltipIcon, tooltipLinkTarget, tooltipDataTestId, noError } = _a, props = __rest(_a, ["name", "inputId", "fieldClassName", "label", "touched", "error", "tooltipText", "tooltipLink", "tooltipLinkText", "tooltipIcon", "tooltipLinkTarget", "tooltipDataTestId", "noError"]);
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: cx(styles.field, fieldClassName), "data-testid": `${name}-field-container` },
        React.createElement("label", { className: styles.wrapper, htmlFor: inputId },
            React.createElement("input", Object.assign({ id: inputId, name: name, type: "checkbox" }, props, { "data-testid": `${name}-checkbox-input`, className: styles.input })),
            React.createElement("span", { className: styles.checkmark }),
            React.createElement(LabelCore, { name: name, label: label, labelWrapperClassName: styles.checkmarkLabel, labelClassName: styles.label, inputId: inputId, tooltipLink: tooltipLink, tooltipLinkText: tooltipLinkText, tooltipText: tooltipText, tooltipDataTestId: tooltipDataTestId, tooltipLinkTarget: tooltipLinkTarget, tooltipIcon: tooltipIcon })),
        !noError && (React.createElement("div", { "data-testid": `${name}-field-error-message`, className: styles.errorMessage }, touched && error))));
};
BaseCheckbox.displayName = 'Checkbox';
//# sourceMappingURL=Checkbox.js.map