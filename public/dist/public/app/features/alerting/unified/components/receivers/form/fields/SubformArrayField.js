import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Button, useStyles2 } from '@grafana/ui';
import { CollapsibleSection } from '../CollapsibleSection';
import { ActionIcon } from '../../../rules/ActionIcon';
import { OptionField } from './OptionField';
import { useControlledFieldArray } from 'app/features/alerting/unified/hooks/useControlledFieldArray';
import { getReceiverFormFieldStyles } from './styles';
export var SubformArrayField = function (_a) {
    var _b;
    var option = _a.option, pathPrefix = _a.pathPrefix, errors = _a.errors, defaultValues = _a.defaultValues, _c = _a.readOnly, readOnly = _c === void 0 ? false : _c;
    var styles = useStyles2(getReceiverFormFieldStyles);
    var path = "" + pathPrefix + option.propertyName;
    var formAPI = useFormContext();
    var _d = useControlledFieldArray({ name: path, formAPI: formAPI, defaults: defaultValues }), fields = _d.fields, append = _d.append, remove = _d.remove;
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(CollapsibleSection, { className: styles.collapsibleSection, label: option.label + " (" + fields.length + ")", description: option.description },
            ((_b = fields !== null && fields !== void 0 ? fields : defaultValues) !== null && _b !== void 0 ? _b : []).map(function (field, itemIndex) {
                var _a;
                return (React.createElement("div", { key: itemIndex, className: styles.wrapper },
                    !readOnly && (React.createElement(ActionIcon, { "data-testid": path + "." + itemIndex + ".delete-button", icon: "trash-alt", tooltip: "delete", onClick: function () { return remove(itemIndex); }, className: styles.deleteIcon })), (_a = option.subformOptions) === null || _a === void 0 ? void 0 :
                    _a.map(function (option) {
                        var _a;
                        return (React.createElement(OptionField, { readOnly: readOnly, defaultValue: field === null || field === void 0 ? void 0 : field[option.propertyName], key: option.propertyName, option: option, pathPrefix: path + "." + itemIndex + ".", error: (_a = errors === null || errors === void 0 ? void 0 : errors[itemIndex]) === null || _a === void 0 ? void 0 : _a[option.propertyName] }));
                    })));
            }),
            !readOnly && (React.createElement(Button, { "data-testid": path + ".add-button", className: styles.addButton, type: "button", variant: "secondary", icon: "plus", size: "sm", onClick: function () { return append({ __id: String(Math.random()) }); } }, "Add")))));
};
//# sourceMappingURL=SubformArrayField.js.map