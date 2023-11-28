import { __rest } from "tslib";
import { BasicConfig, Utils, } from '@react-awesome-query-builder/ui';
import { isString } from 'lodash';
import React from 'react';
import { dateTime, toOption } from '@grafana/data';
import { Button, DateTimePicker, Input, Select } from '@grafana/ui';
const buttonLabels = {
    add: 'Add',
    remove: 'Remove',
};
export const emptyInitValue = {
    id: Utils.uuid(),
    type: 'group',
    children1: {
        [Utils.uuid()]: {
            type: 'rule',
            properties: {
                field: null,
                operator: null,
                value: [],
                valueSrc: [],
            },
        },
    },
};
export const emptyInitTree = {
    id: Utils.uuid(),
    type: 'group',
    children1: {
        [Utils.uuid()]: {
            type: 'rule',
            properties: {
                field: null,
                operator: null,
                value: [],
                valueSrc: [],
            },
        },
    },
};
export const widgets = Object.assign(Object.assign({}, BasicConfig.widgets), { text: Object.assign(Object.assign({}, BasicConfig.widgets.text), { factory: function TextInput(props) {
            return (React.createElement(Input, { value: (props === null || props === void 0 ? void 0 : props.value) || '', placeholder: props === null || props === void 0 ? void 0 : props.placeholder, onChange: (e) => props === null || props === void 0 ? void 0 : props.setValue(e.currentTarget.value) }));
        } }), number: Object.assign(Object.assign({}, BasicConfig.widgets.number), { factory: function NumberInput(props) {
            return (React.createElement(Input, { value: props === null || props === void 0 ? void 0 : props.value, placeholder: props === null || props === void 0 ? void 0 : props.placeholder, type: "number", onChange: (e) => props === null || props === void 0 ? void 0 : props.setValue(Number.parseInt(e.currentTarget.value, 10)) }));
        } }), datetime: Object.assign(Object.assign({}, BasicConfig.widgets.datetime), { factory: function DateTimeInput(props) {
            return (React.createElement(DateTimePicker, { onChange: (e) => {
                    props === null || props === void 0 ? void 0 : props.setValue(e.format(BasicConfig.widgets.datetime.valueFormat));
                }, date: dateTime(props === null || props === void 0 ? void 0 : props.value).utc() }));
        } }) });
export const settings = Object.assign(Object.assign({}, BasicConfig.settings), { canRegroup: false, maxNesting: 1, canReorder: false, showNot: false, addRuleLabel: buttonLabels.add, deleteLabel: buttonLabels.remove, renderConjs: function Conjunctions(conjProps) {
        return (React.createElement(Select, { id: conjProps === null || conjProps === void 0 ? void 0 : conjProps.id, "aria-label": "Conjunction", menuShouldPortal: true, options: (conjProps === null || conjProps === void 0 ? void 0 : conjProps.conjunctionOptions) ? Object.keys(conjProps === null || conjProps === void 0 ? void 0 : conjProps.conjunctionOptions).map(toOption) : undefined, value: conjProps === null || conjProps === void 0 ? void 0 : conjProps.selectedConjunction, onChange: (val) => conjProps === null || conjProps === void 0 ? void 0 : conjProps.setConjunction(val.value) }));
    }, renderField: function Field(fieldProps) {
        var _a;
        const fields = ((_a = fieldProps === null || fieldProps === void 0 ? void 0 : fieldProps.config) === null || _a === void 0 ? void 0 : _a.fields) || {};
        return (React.createElement(Select, { id: fieldProps === null || fieldProps === void 0 ? void 0 : fieldProps.id, width: 25, "aria-label": "Field", menuShouldPortal: true, options: fieldProps === null || fieldProps === void 0 ? void 0 : fieldProps.items.map((f) => {
                var _a, _b;
                // @ts-ignore
                const icon = (_b = (_a = fields[f.key].mainWidgetProps) === null || _a === void 0 ? void 0 : _a.customProps) === null || _b === void 0 ? void 0 : _b.icon;
                return {
                    label: f.label,
                    value: f.key,
                    icon,
                };
            }), value: fieldProps === null || fieldProps === void 0 ? void 0 : fieldProps.selectedKey, onChange: (val) => {
                fieldProps === null || fieldProps === void 0 ? void 0 : fieldProps.setField(val.label);
            } }));
    }, renderButton: function RAQBButton(buttonProps) {
        return (React.createElement(Button, { type: "button", title: `${buttonProps === null || buttonProps === void 0 ? void 0 : buttonProps.label} filter`, onClick: buttonProps === null || buttonProps === void 0 ? void 0 : buttonProps.onClick, variant: "secondary", size: "md", icon: (buttonProps === null || buttonProps === void 0 ? void 0 : buttonProps.label) === buttonLabels.add ? 'plus' : 'times' }));
    }, renderOperator: function Operator(operatorProps) {
        return (React.createElement(Select, { options: operatorProps === null || operatorProps === void 0 ? void 0 : operatorProps.items.map((op) => ({ label: op.label, value: op.key })), "aria-label": "Operator", menuShouldPortal: true, value: operatorProps === null || operatorProps === void 0 ? void 0 : operatorProps.selectedKey, onChange: (val) => {
                operatorProps === null || operatorProps === void 0 ? void 0 : operatorProps.setField(val.value || '');
            } }));
    } });
// eslint-ignore
const customOperators = getCustomOperators(BasicConfig);
const textWidget = BasicConfig.types.text.widgets.text;
const opers = [...(textWidget.operators || []), "select_any_in" /* Op.IN */, "select_not_any_in" /* Op.NOT_IN */];
const customTextWidget = Object.assign(Object.assign({}, textWidget), { operators: opers });
const customTypes = Object.assign(Object.assign({}, BasicConfig.types), { text: Object.assign(Object.assign({}, BasicConfig.types.text), { widgets: Object.assign(Object.assign({}, BasicConfig.types.text.widgets), { text: customTextWidget }) }) });
export const raqbConfig = Object.assign(Object.assign({}, BasicConfig), { widgets,
    settings, operators: customOperators, types: customTypes });
const noop = () => '';
const isSqlFormatOp = (func) => {
    return typeof func === 'function';
};
function getCustomOperators(config) {
    const supportedOperators = __rest(config.operators, []);
    // IN operator expects array, override IN formatter for multi-value variables
    const sqlFormatInOpOrNoop = () => {
        const sqlFormatOp = supportedOperators["select_any_in" /* Op.IN */].sqlFormatOp;
        if (isSqlFormatOp(sqlFormatOp)) {
            return sqlFormatOp;
        }
        return noop;
    };
    const customSqlInFormatter = (field, op, value, valueSrc, valueType, opDef, operatorOptions, fieldDef) => {
        return sqlFormatInOpOrNoop()(field, op, splitIfString(value), valueSrc, valueType, opDef, operatorOptions, fieldDef);
    };
    // NOT IN operator expects array, override NOT IN formatter for multi-value variables
    const sqlFormatNotInOpOrNoop = () => {
        const sqlFormatOp = supportedOperators["select_not_any_in" /* Op.NOT_IN */].sqlFormatOp;
        if (isSqlFormatOp(sqlFormatOp)) {
            return sqlFormatOp;
        }
        return noop;
    };
    const customSqlNotInFormatter = (field, op, value, valueSrc, valueType, opDef, operatorOptions, fieldDef) => {
        return sqlFormatNotInOpOrNoop()(field, op, splitIfString(value), valueSrc, valueType, opDef, operatorOptions, fieldDef);
    };
    const customOperators = Object.assign(Object.assign({}, supportedOperators), { ["select_any_in" /* Op.IN */]: Object.assign(Object.assign({}, supportedOperators["select_any_in" /* Op.IN */]), { sqlFormatOp: customSqlInFormatter }), ["select_not_any_in" /* Op.NOT_IN */]: Object.assign(Object.assign({}, supportedOperators["select_not_any_in" /* Op.NOT_IN */]), { sqlFormatOp: customSqlNotInFormatter }) });
    return customOperators;
}
// value: string | List<string> but AQB uses a different version of Immutable
// eslint-ignore
function splitIfString(value) {
    if (isString(value)) {
        return value.split(',');
    }
    return value;
}
//# sourceMappingURL=AwesomeQueryBuilder.js.map