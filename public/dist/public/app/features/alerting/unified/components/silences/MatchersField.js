import { __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Button, Field, Input, IconButton, InputControl, useStyles2, Select } from '@grafana/ui';
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import { matcherFieldOptions } from '../../utils/alertmanager';
const MatchersField = ({ className }) => {
    const styles = useStyles2(getStyles);
    const formApi = useFormContext();
    const { control, register, formState: { errors }, } = formApi;
    const { fields: matchers = [], append, remove } = useFieldArray({ name: 'matchers' });
    return (React.createElement("div", { className: cx(className, styles.wrapper) },
        React.createElement(Field, { label: "Matching labels", required: true },
            React.createElement("div", null,
                React.createElement("div", { className: styles.matchers }, matchers.map((matcher, index) => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                    return (React.createElement("div", { className: styles.row, key: `${matcher.id}`, "data-testid": "matcher" },
                        React.createElement(Field, { label: "Label", invalid: !!((_b = (_a = errors === null || errors === void 0 ? void 0 : errors.matchers) === null || _a === void 0 ? void 0 : _a[index]) === null || _b === void 0 ? void 0 : _b.name), error: (_e = (_d = (_c = errors === null || errors === void 0 ? void 0 : errors.matchers) === null || _c === void 0 ? void 0 : _c[index]) === null || _d === void 0 ? void 0 : _d.name) === null || _e === void 0 ? void 0 : _e.message },
                            React.createElement(Input, Object.assign({}, register(`matchers.${index}.name`, {
                                required: { value: true, message: 'Required.' },
                            }), { defaultValue: matcher.name, placeholder: "label" }))),
                        React.createElement(Field, { label: 'Operator' },
                            React.createElement(InputControl, { control: control, render: (_a) => {
                                    var _b = _a.field, { onChange, ref } = _b, field = __rest(_b, ["onChange", "ref"]);
                                    return (React.createElement(Select, Object.assign({}, field, { onChange: (value) => onChange(value.value), className: styles.matcherOptions, options: matcherFieldOptions, "aria-label": "operator" })));
                                }, defaultValue: matcher.operator || matcherFieldOptions[0].value, name: `matchers.${index}.operator`, rules: { required: { value: true, message: 'Required.' } } })),
                        React.createElement(Field, { label: "Value", invalid: !!((_g = (_f = errors === null || errors === void 0 ? void 0 : errors.matchers) === null || _f === void 0 ? void 0 : _f[index]) === null || _g === void 0 ? void 0 : _g.value), error: (_k = (_j = (_h = errors === null || errors === void 0 ? void 0 : errors.matchers) === null || _h === void 0 ? void 0 : _h[index]) === null || _j === void 0 ? void 0 : _j.value) === null || _k === void 0 ? void 0 : _k.message },
                            React.createElement(Input, Object.assign({}, register(`matchers.${index}.value`, {
                                required: { value: true, message: 'Required.' },
                            }), { defaultValue: matcher.value, placeholder: "value" }))),
                        matchers.length > 1 && (React.createElement(IconButton, { className: styles.removeButton, tooltip: "Remove matcher", name: "trash-alt", onClick: () => remove(index) }, "Remove"))));
                })),
                React.createElement(Button, { type: "button", icon: "plus", variant: "secondary", onClick: () => {
                        const newMatcher = { name: '', value: '', operator: MatcherOperator.equal };
                        append(newMatcher);
                    } }, "Add matcher")))));
};
const getStyles = (theme) => {
    return {
        wrapper: css `
      margin-top: ${theme.spacing(2)};
    `,
        row: css `
      display: flex;
      align-items: flex-start;
      flex-direction: row;
      background-color: ${theme.colors.background.secondary};
      padding: ${theme.spacing(1)} ${theme.spacing(1)} 0 ${theme.spacing(1)};
      & > * + * {
        margin-left: ${theme.spacing(2)};
      }
    `,
        removeButton: css `
      margin-left: ${theme.spacing(1)};
      margin-top: ${theme.spacing(2.5)};
    `,
        matcherOptions: css `
      min-width: 140px;
    `,
        matchers: css `
      max-width: ${theme.breakpoints.values.sm}px;
      margin: ${theme.spacing(1)} 0;
      padding-top: ${theme.spacing(0.5)};
    `,
    };
};
export default MatchersField;
//# sourceMappingURL=MatchersField.js.map