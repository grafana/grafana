import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Button, useStyles2 } from '@grafana/ui';
import { useControlledFieldArray } from 'app/features/alerting/unified/hooks/useControlledFieldArray';
import { ActionIcon } from '../../../rules/ActionIcon';
import { CollapsibleSection } from '../CollapsibleSection';
import { OptionField } from './OptionField';
import { getReceiverFormFieldStyles } from './styles';
export const SubformArrayField = ({ option, pathPrefix, errors, defaultValues, readOnly = false }) => {
    var _a;
    const styles = useStyles2(getReceiverFormFieldStyles);
    const path = `${pathPrefix}${option.propertyName}`;
    const formAPI = useFormContext();
    const { fields, append, remove } = useControlledFieldArray({ name: path, formAPI, defaults: defaultValues });
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(CollapsibleSection, { className: styles.collapsibleSection, label: `${option.label} (${fields.length})`, description: option.description },
            ((_a = fields !== null && fields !== void 0 ? fields : defaultValues) !== null && _a !== void 0 ? _a : []).map((field, itemIndex) => {
                var _a;
                return (React.createElement("div", { key: itemIndex, className: styles.wrapper },
                    !readOnly && (React.createElement(ActionIcon, { "data-testid": `${path}.${itemIndex}.delete-button`, icon: "trash-alt", tooltip: "delete", onClick: () => remove(itemIndex), className: styles.deleteIcon })), (_a = option.subformOptions) === null || _a === void 0 ? void 0 :
                    _a.map((option) => {
                        var _a;
                        return (React.createElement(OptionField, { readOnly: readOnly, defaultValue: field === null || field === void 0 ? void 0 : field[option.propertyName], key: option.propertyName, option: option, pathPrefix: `${path}.${itemIndex}.`, error: (_a = errors === null || errors === void 0 ? void 0 : errors[itemIndex]) === null || _a === void 0 ? void 0 : _a[option.propertyName] }));
                    })));
            }),
            !readOnly && (React.createElement(Button, { "data-testid": `${path}.add-button`, className: styles.addButton, type: "button", variant: "secondary", icon: "plus", size: "sm", onClick: () => append({ __id: String(Math.random()) }) }, "Add")))));
};
//# sourceMappingURL=SubformArrayField.js.map