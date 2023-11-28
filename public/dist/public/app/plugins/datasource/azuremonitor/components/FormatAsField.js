import React, { useCallback, useMemo } from 'react';
import { useEffectOnce } from 'react-use';
import { Select } from '@grafana/ui';
import { selectors } from '../e2e/selectors';
import { Field } from './Field';
const FormatAsField = ({ query, variableOptionGroup, onQueryChange, inputId, options: formatOptions, defaultValue, setFormatAs, resultFormat, }) => {
    const options = useMemo(() => [...formatOptions, variableOptionGroup], [variableOptionGroup, formatOptions]);
    const handleChange = useCallback((change) => {
        const { value } = change;
        if (!value) {
            return;
        }
        const newQuery = setFormatAs(query, value);
        onQueryChange(newQuery);
    }, [onQueryChange, query, setFormatAs]);
    useEffectOnce(() => {
        if (!resultFormat) {
            handleChange({ value: defaultValue });
        }
        else {
            if (!formatOptions.find((item) => item.value === resultFormat)) {
                handleChange({ value: defaultValue });
            }
        }
    });
    return (React.createElement(Field, { label: "Format as", "data-testid": selectors.components.queryEditor.logsQueryEditor.formatSelection.input },
        React.createElement(Select, { inputId: `${inputId}-format-as-field`, value: resultFormat !== null && resultFormat !== void 0 ? resultFormat : defaultValue, onChange: handleChange, options: options, width: 38 })));
};
export default FormatAsField;
//# sourceMappingURL=FormatAsField.js.map