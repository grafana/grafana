import React from 'react';
import { Field } from 'react-final-form';
import { SelectField } from 'app/percona/shared/components/Form/SelectField';
import { ALL_LABEL, ALL_VALUE } from '../../Filter.constants';
import { buildColumnOptions } from '../../Filter.utils';
export const SelectDropdownField = ({ column }) => {
    const columnOptions = buildColumnOptions(column);
    return (React.createElement("div", null,
        React.createElement(Field, { name: `${column.accessor}` }, ({ input }) => {
            var _a;
            return (React.createElement(SelectField, Object.assign({ options: columnOptions, defaultValue: { value: ALL_VALUE, label: ALL_LABEL }, label: (_a = column.label) !== null && _a !== void 0 ? _a : column.Header }, input, { "data-testid": "select-dropdown" })));
        })));
};
//# sourceMappingURL=SelectDropdownField.js.map