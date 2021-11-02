import React, { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Select } from '@grafana/ui';
import { getVariables } from '../../../variables/state/selectors';
export var RepeatRowSelect = function (_a) {
    var repeat = _a.repeat, onChange = _a.onChange, id = _a.id;
    var variables = useSelector(function (state) { return getVariables(state); });
    var variableOptions = useMemo(function () {
        var options = variables.map(function (item) {
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
    var onSelectChange = useCallback(function (option) { return onChange(option.value); }, [onChange]);
    return React.createElement(Select, { inputId: id, menuShouldPortal: true, value: repeat, onChange: onSelectChange, options: variableOptions });
};
//# sourceMappingURL=RepeatRowSelect.js.map