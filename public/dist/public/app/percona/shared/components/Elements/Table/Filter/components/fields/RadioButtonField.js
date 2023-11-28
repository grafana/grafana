import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';
import { ALL_VALUE } from '../../Filter.constants';
import { buildColumnOptions } from '../../Filter.utils';
import { getStyles } from './RadioButtonField.styles';
export const RadioButtonField = ({ column }) => {
    var _a;
    const columnOptions = buildColumnOptions(column);
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.radioButtonField },
        React.createElement(RadioButtonGroupField, { options: columnOptions, defaultValue: ALL_VALUE, name: `${column.accessor}`, label: (_a = column.label) !== null && _a !== void 0 ? _a : column.Header, fullWidth: true, "data-testid": "radio-button" })));
};
//# sourceMappingURL=RadioButtonField.js.map