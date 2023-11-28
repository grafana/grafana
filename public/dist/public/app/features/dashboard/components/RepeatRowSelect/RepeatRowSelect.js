import React, { useCallback, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { useSelector } from 'app/types';
import { getLastKey, getVariablesByKey } from '../../../variables/state/selectors';
export const RepeatRowSelect = ({ repeat, onChange, id }) => {
    const variables = useSelector((state) => {
        return getVariablesByKey(getLastKey(state), state);
    });
    const variableOptions = useMemo(() => {
        const options = variables.map((item) => {
            return { label: item.name, value: item.name };
        });
        if (options.length === 0) {
            options.unshift({
                label: 'No template variables found',
                value: null,
            });
        }
        options.unshift({
            label: 'Disable repeating',
            value: null,
        });
        return options;
    }, [variables]);
    const onSelectChange = useCallback((option) => onChange(option.value), [onChange]);
    return React.createElement(Select, { inputId: id, value: repeat, onChange: onSelectChange, options: variableOptions });
};
//# sourceMappingURL=RepeatRowSelect.js.map