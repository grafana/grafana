import { css } from '@emotion/css';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2 } from '@grafana/ui';
import { VariableCheckboxField } from '../editor/VariableCheckboxField';
import { VariableLegend } from '../editor/VariableLegend';
import { VariableSelectField } from '../editor/VariableSelectField';
import { VariableTextField } from '../editor/VariableTextField';
const STEP_OPTIONS = [1, 2, 3, 4, 5, 10, 20, 30, 40, 50, 100, 200, 300, 400, 500].map((count) => ({
    label: `${count}`,
    value: count,
}));
export const IntervalVariableEditor = React.memo(({ onPropChange, variable }) => {
    var _a;
    const onAutoChange = (event) => {
        onPropChange({
            propName: 'auto',
            propValue: event.target.checked,
            updateOptions: true,
        });
    };
    const onQueryChanged = (event) => {
        onPropChange({
            propName: 'query',
            propValue: event.currentTarget.value,
        });
    };
    const onQueryBlur = (event) => {
        onPropChange({
            propName: 'query',
            propValue: event.currentTarget.value,
            updateOptions: true,
        });
    };
    const onAutoCountChanged = (option) => {
        onPropChange({
            propName: 'auto_count',
            propValue: option.value,
            updateOptions: true,
        });
    };
    const onAutoMinChanged = (event) => {
        onPropChange({
            propName: 'auto_min',
            propValue: event.currentTarget.value,
            updateOptions: true,
        });
    };
    const stepValue = (_a = STEP_OPTIONS.find((o) => o.value === variable.auto_count)) !== null && _a !== void 0 ? _a : STEP_OPTIONS[0];
    const styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement(VariableLegend, null, "Interval options"),
        React.createElement(VariableTextField, { value: variable.query, name: "Values", placeholder: "1m,10m,1h,6h,1d,7d", onChange: onQueryChanged, onBlur: onQueryBlur, testId: selectors.pages.Dashboard.Settings.Variables.Edit.IntervalVariable.intervalsValueInput, width: 32, required: true }),
        React.createElement(VariableCheckboxField, { value: variable.auto, name: "Auto option", description: "Dynamically calculates interval by dividing time range by the count specified", onChange: onAutoChange }),
        variable.auto && (React.createElement("div", { className: styles.autoFields },
            React.createElement(VariableSelectField, { name: "Step count", description: "How many times the current time range should be divided to calculate the value", value: stepValue, options: STEP_OPTIONS, onChange: onAutoCountChanged, width: 9 }),
            React.createElement(VariableTextField, { value: variable.auto_min, name: "Min interval", description: "The calculated value will not go below this threshold", placeholder: "10s", onChange: onAutoMinChanged, width: 11 })))));
});
IntervalVariableEditor.displayName = 'IntervalVariableEditor';
function getStyles(theme) {
    return {
        autoFields: css({
            marginTop: theme.spacing(2),
            display: 'flex',
            flexDirection: 'column',
        }),
    };
}
//# sourceMappingURL=IntervalVariableEditor.js.map