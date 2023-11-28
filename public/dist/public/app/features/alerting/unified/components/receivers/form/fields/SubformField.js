import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Button, useStyles2 } from '@grafana/ui';
import { ActionIcon } from '../../../rules/ActionIcon';
import { OptionField } from './OptionField';
import { getReceiverFormFieldStyles } from './styles';
export const SubformField = ({ option, pathPrefix, errors, defaultValue, readOnly = false }) => {
    var _a;
    const styles = useStyles2(getReceiverFormFieldStyles);
    const name = `${pathPrefix}${option.propertyName}`;
    const { watch } = useFormContext();
    const _watchValue = watch(name);
    const value = _watchValue === undefined ? defaultValue : _watchValue;
    const [show, setShow] = useState(!!value);
    return (React.createElement("div", { className: styles.wrapper, "data-testid": `${name}.container` },
        React.createElement("h6", null, option.label),
        option.description && React.createElement("p", { className: styles.description }, option.description),
        show && (React.createElement(React.Fragment, null,
            !readOnly && (React.createElement(ActionIcon, { "data-testid": `${name}.delete-button`, icon: "trash-alt", tooltip: "delete", onClick: () => setShow(false), className: styles.deleteIcon })),
            ((_a = option.subformOptions) !== null && _a !== void 0 ? _a : []).map((subOption) => {
                return (React.createElement(OptionField, { readOnly: readOnly, defaultValue: defaultValue === null || defaultValue === void 0 ? void 0 : defaultValue[subOption.propertyName], key: subOption.propertyName, option: subOption, pathPrefix: `${name}.`, error: errors === null || errors === void 0 ? void 0 : errors[subOption.propertyName] }));
            }))),
        !show && !readOnly && (React.createElement(Button, { className: styles.addButton, type: "button", variant: "secondary", icon: "plus", size: "sm", onClick: () => setShow(true), "data-testid": `${name}.add-button` }, "Add"))));
};
//# sourceMappingURL=SubformField.js.map