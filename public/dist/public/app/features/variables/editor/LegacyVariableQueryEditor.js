import { useId } from '@react-aria/utils';
import React, { useCallback, useState } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { TextArea, useStyles2 } from '@grafana/ui';
import { getStyles } from './VariableTextAreaField';
export const LEGACY_VARIABLE_QUERY_EDITOR_NAME = 'Grafana-LegacyVariableQueryEditor';
export const LegacyVariableQueryEditor = ({ onChange, query }) => {
    const styles = useStyles2(getStyles);
    const [value, setValue] = useState(query);
    const onValueChange = (event) => {
        setValue(event.currentTarget.value);
    };
    const onBlur = useCallback((event) => {
        onChange(event.currentTarget.value, event.currentTarget.value);
    }, [onChange]);
    const id = useId();
    return (React.createElement(TextArea, { id: id, rows: 2, value: value, onChange: onValueChange, onBlur: onBlur, placeholder: "Metric name or tags query", required: true, "aria-label": selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput, cols: 52, className: styles.textarea }));
};
LegacyVariableQueryEditor.displayName = LEGACY_VARIABLE_QUERY_EDITOR_NAME;
//# sourceMappingURL=LegacyVariableQueryEditor.js.map