import { __rest } from "tslib";
import { css } from '@emotion/css';
import { compact, fill } from 'lodash';
import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { SupportedTransformationType } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Button, Field, FieldArray, Icon, IconButton, Input, InputControl, Label, Select, Tooltip, useStyles2, } from '@grafana/ui';
const getStyles = (theme) => ({
    heading: css `
    font-size: ${theme.typography.h5.fontSize};
    font-weight: ${theme.typography.fontWeightRegular};
  `,
    // set fixed position from the top instead of centring as the container
    // may get bigger when the for is invalid
    removeButton: css `
    margin-top: 25px;
  `,
});
export const TransformationsEditor = (props) => {
    const { control, formState, register, setValue, watch, getValues } = useFormContext();
    const { readOnly } = props;
    const [keptVals, setKeptVals] = useState([]);
    const styles = useStyles2(getStyles);
    const transformOptions = getTransformOptions();
    return (React.createElement(React.Fragment, null,
        React.createElement("input", Object.assign({ type: "hidden" }, register('id'))),
        React.createElement(FieldArray, { name: "config.transformations", control: control }, ({ fields, append, remove }) => (React.createElement(React.Fragment, null,
            React.createElement(Stack, { direction: "column", alignItems: "flex-start" },
                React.createElement("div", { className: styles.heading }, "Transformations"),
                fields.length === 0 && React.createElement("div", null, " No transformations defined."),
                fields.length > 0 && (React.createElement("div", null, fields.map((fieldVal, index) => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
                    return (React.createElement(Stack, { direction: "row", key: fieldVal.id, alignItems: "top" },
                        React.createElement(Field, { label: React.createElement(Stack, { gap: 0.5 },
                                React.createElement(Label, { htmlFor: `config.transformations.${fieldVal.id}-${index}.type` }, "Type"),
                                React.createElement(Tooltip, { content: React.createElement("div", null,
                                        React.createElement("p", null, "The type of transformation that will be applied to the source data.")) },
                                    React.createElement(Icon, { name: "info-circle", size: "sm" }))), invalid: !!((_d = (_c = (_b = (_a = formState.errors) === null || _a === void 0 ? void 0 : _a.config) === null || _b === void 0 ? void 0 : _b.transformations) === null || _c === void 0 ? void 0 : _c[index]) === null || _d === void 0 ? void 0 : _d.type), error: (_j = (_h = (_g = (_f = (_e = formState.errors) === null || _e === void 0 ? void 0 : _e.config) === null || _f === void 0 ? void 0 : _f.transformations) === null || _g === void 0 ? void 0 : _g[index]) === null || _h === void 0 ? void 0 : _h.type) === null || _j === void 0 ? void 0 : _j.message, validationMessageHorizontalOverflow: true },
                            React.createElement(InputControl, { render: (_a) => {
                                    var _b = _a.field, { onChange, ref } = _b, field = __rest(_b, ["onChange", "ref"]);
                                    // input control field is not manipulated with remove, use value from control
                                    return (React.createElement(Select, Object.assign({}, field, { value: fieldVal.type, onChange: (value) => {
                                            var _a, _b;
                                            if (!readOnly) {
                                                const currentValues = getValues().config.transformations[index];
                                                let keptValsCopy = fill(Array(index + 1), {});
                                                keptVals.forEach((keptVal, i) => (keptValsCopy[i] = keptVal));
                                                keptValsCopy[index] = {
                                                    expression: currentValues.expression,
                                                    mapValue: currentValues.mapValue,
                                                };
                                                setKeptVals(keptValsCopy);
                                                const newValueDetails = getSupportedTransTypeDetails(value.value);
                                                if (newValueDetails.showExpression) {
                                                    setValue(`config.transformations.${index}.expression`, ((_a = keptVals[index]) === null || _a === void 0 ? void 0 : _a.expression) || '');
                                                }
                                                else {
                                                    setValue(`config.transformations.${index}.expression`, '');
                                                }
                                                if (newValueDetails.showMapValue) {
                                                    setValue(`config.transformations.${index}.mapValue`, ((_b = keptVals[index]) === null || _b === void 0 ? void 0 : _b.mapValue) || '');
                                                }
                                                else {
                                                    setValue(`config.transformations.${index}.mapValue`, '');
                                                }
                                                onChange(value.value);
                                            }
                                        }, options: transformOptions, width: 25, inputId: `config.transformations.${fieldVal.id}-${index}.type` })));
                                }, control: control, name: `config.transformations.${index}.type`, rules: { required: { value: true, message: 'Please select a transformation type' } } })),
                        React.createElement(Field, { label: React.createElement(Stack, { gap: 0.5 },
                                React.createElement(Label, { htmlFor: `config.transformations.${fieldVal.id}.field` }, "Field"),
                                React.createElement(Tooltip, { content: React.createElement("div", null,
                                        React.createElement("p", null, "Optional. The field to transform. If not specified, the transformation will be applied to the results field.")) },
                                    React.createElement(Icon, { name: "info-circle", size: "sm" }))) },
                            React.createElement(Input, Object.assign({}, register(`config.transformations.${index}.field`), { readOnly: readOnly, defaultValue: fieldVal.field, label: "field", id: `config.transformations.${fieldVal.id}.field` }))),
                        React.createElement(Field, { label: React.createElement(Stack, { gap: 0.5 },
                                React.createElement(Label, { htmlFor: `config.transformations.${fieldVal.id}.expression` },
                                    "Expression",
                                    getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`))
                                        .requireExpression
                                        ? ' *'
                                        : ''),
                                React.createElement(Tooltip, { content: React.createElement("div", null,
                                        React.createElement("p", null, "Required for regular expression. The expression the transformation will use. Logfmt does not use further specifications.")) },
                                    React.createElement(Icon, { name: "info-circle", size: "sm" }))), invalid: !!((_o = (_m = (_l = (_k = formState.errors) === null || _k === void 0 ? void 0 : _k.config) === null || _l === void 0 ? void 0 : _l.transformations) === null || _m === void 0 ? void 0 : _m[index]) === null || _o === void 0 ? void 0 : _o.expression), error: (_t = (_s = (_r = (_q = (_p = formState.errors) === null || _p === void 0 ? void 0 : _p.config) === null || _q === void 0 ? void 0 : _q.transformations) === null || _r === void 0 ? void 0 : _r[index]) === null || _s === void 0 ? void 0 : _s.expression) === null || _t === void 0 ? void 0 : _t.message },
                            React.createElement(Input, Object.assign({}, register(`config.transformations.${index}.expression`, {
                                required: getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`))
                                    .requireExpression
                                    ? 'Please define an expression'
                                    : undefined,
                            }), { defaultValue: fieldVal.expression, readOnly: readOnly, disabled: !getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`))
                                    .showExpression, id: `config.transformations.${fieldVal.id}.expression` }))),
                        React.createElement(Field, { label: React.createElement(Stack, { gap: 0.5 },
                                React.createElement(Label, { htmlFor: `config.transformations.${fieldVal.id}.mapValue` }, "Map value"),
                                React.createElement(Tooltip, { content: React.createElement("div", null,
                                        React.createElement("p", null, "Optional. Defines the name of the variable. This is currently only valid for regular expressions with a single, unnamed capture group.")) },
                                    React.createElement(Icon, { name: "info-circle", size: "sm" }))) },
                            React.createElement(Input, Object.assign({}, register(`config.transformations.${index}.mapValue`), { defaultValue: fieldVal.mapValue, readOnly: readOnly, disabled: !getSupportedTransTypeDetails(watch(`config.transformations.${index}.type`)).showMapValue, id: `config.transformations.${fieldVal.id}.mapValue` }))),
                        !readOnly && (React.createElement("div", { className: styles.removeButton },
                            React.createElement(IconButton, { tooltip: "Remove transformation", name: "trash-alt", onClick: () => {
                                    remove(index);
                                    const keptValsCopy = [
                                        ...keptVals,
                                    ];
                                    keptValsCopy[index] = undefined;
                                    setKeptVals(compact(keptValsCopy));
                                } }, "Remove")))));
                }))),
                !readOnly && (React.createElement(Button, { icon: "plus", onClick: () => append({ type: undefined }, { shouldFocus: false }), variant: "secondary", type: "button" }, "Add transformation"))))))));
};
function getSupportedTransTypeDetails(transType) {
    switch (transType) {
        case SupportedTransformationType.Logfmt:
            return {
                label: 'Logfmt',
                value: SupportedTransformationType.Logfmt,
                description: 'Parse provided field with logfmt to get variables',
                showExpression: false,
                showMapValue: false,
            };
        case SupportedTransformationType.Regex:
            return {
                label: 'Regular expression',
                value: SupportedTransformationType.Regex,
                description: 'Field will be parsed with regex. Use named capture groups to return multiple variables, or a single unnamed capture group to add variable to named map value.',
                showExpression: true,
                showMapValue: true,
                requireExpression: true,
            };
        default:
            return { label: transType, value: transType, showExpression: false, showMapValue: false };
    }
}
const getTransformOptions = () => {
    return Object.values(SupportedTransformationType).map((transformationType) => {
        const transType = getSupportedTransTypeDetails(transformationType);
        return {
            label: transType.label,
            value: transType.value,
            description: transType.description,
        };
    });
};
//# sourceMappingURL=TransformationsEditor.js.map