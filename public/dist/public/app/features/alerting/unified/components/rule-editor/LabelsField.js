import { css, cx } from '@emotion/css';
import { flattenDeep, compact } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Stack } from '@grafana/experimental';
import { Button, Field, InlineLabel, Label, useStyles2, Text, Tooltip, Icon, Input, LoadingPlaceholder, } from '@grafana/ui';
import { useDispatch } from 'app/types';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesIfNotFetchedYet } from '../../state/actions';
import AlertLabelDropdown from '../AlertLabelDropdown';
const useGetCustomLabels = (dataSourceName) => {
    const dispatch = useDispatch();
    useEffect(() => {
        dispatch(fetchRulerRulesIfNotFetchedYet(dataSourceName));
    }, [dispatch, dataSourceName]);
    const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
    const rulerRequest = rulerRuleRequests[dataSourceName];
    const result = (rulerRequest === null || rulerRequest === void 0 ? void 0 : rulerRequest.result) || {};
    //store all labels in a flat array and remove empty values
    const labels = compact(flattenDeep(Object.keys(result).map((ruleGroupKey) => result[ruleGroupKey].map((ruleItem) => ruleItem.rules.map((item) => item.labels)))));
    const labelsByKey = {};
    labels.forEach((label) => {
        Object.entries(label).forEach(([key, value]) => {
            labelsByKey[key] = [...new Set([...(labelsByKey[key] || []), value])];
        });
    });
    return { loading: rulerRequest === null || rulerRequest === void 0 ? void 0 : rulerRequest.loading, labelsByKey };
};
function mapLabelsToOptions(items = []) {
    return items.map((item) => ({ label: item, value: item }));
}
const RemoveButton = ({ remove, className, index }) => (React.createElement(Button, { className: className, "aria-label": "delete label", icon: "trash-alt", "data-testid": `delete-label-${index}`, variant: "secondary", onClick: () => {
        remove(index);
    } }));
const AddButton = ({ append, className }) => (React.createElement(Button, { className: className, icon: "plus-circle", type: "button", variant: "secondary", onClick: () => {
        append({ key: '', value: '' });
    } }, "Add label"));
const LabelsWithSuggestions = ({ dataSourceName }) => {
    const styles = useStyles2(getStyles);
    const { register, control, watch, formState: { errors }, setValue, } = useFormContext();
    const labels = watch('labels');
    const { fields, remove, append } = useFieldArray({ control, name: 'labels' });
    const { loading, labelsByKey } = useGetCustomLabels(dataSourceName);
    const [selectedKey, setSelectedKey] = useState('');
    const keys = useMemo(() => {
        return mapLabelsToOptions(Object.keys(labelsByKey));
    }, [labelsByKey]);
    const getValuesForLabel = useCallback((key) => {
        return mapLabelsToOptions(labelsByKey[key]);
    }, [labelsByKey]);
    const values = useMemo(() => {
        return getValuesForLabel(selectedKey);
    }, [selectedKey, getValuesForLabel]);
    return (React.createElement(React.Fragment, null,
        loading && React.createElement(LoadingPlaceholder, { text: "Loading" }),
        !loading && (React.createElement(Stack, { direction: "column", gap: 0.5 },
            fields.map((field, index) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
                return (React.createElement("div", { key: field.id },
                    React.createElement("div", { className: cx(styles.flexRow, styles.centerAlignRow) },
                        React.createElement(Field, { className: styles.labelInput, invalid: Boolean((_c = (_b = (_a = errors.labels) === null || _a === void 0 ? void 0 : _a[index]) === null || _b === void 0 ? void 0 : _b.key) === null || _c === void 0 ? void 0 : _c.message), error: (_f = (_e = (_d = errors.labels) === null || _d === void 0 ? void 0 : _d[index]) === null || _e === void 0 ? void 0 : _e.key) === null || _f === void 0 ? void 0 : _f.message, "data-testid": `label-key-${index}` },
                            React.createElement(AlertLabelDropdown, Object.assign({}, register(`labels.${index}.key`, {
                                required: { value: Boolean((_g = labels[index]) === null || _g === void 0 ? void 0 : _g.value), message: 'Required.' },
                            }), { defaultValue: field.key ? { label: field.key, value: field.key } : undefined, options: keys, onChange: (newValue) => {
                                    setValue(`labels.${index}.key`, newValue.value);
                                    setSelectedKey(newValue.value);
                                }, type: "key" }))),
                        React.createElement(InlineLabel, { className: styles.equalSign }, "="),
                        React.createElement(Field, { className: styles.labelInput, invalid: Boolean((_k = (_j = (_h = errors.labels) === null || _h === void 0 ? void 0 : _h[index]) === null || _j === void 0 ? void 0 : _j.value) === null || _k === void 0 ? void 0 : _k.message), error: (_o = (_m = (_l = errors.labels) === null || _l === void 0 ? void 0 : _l[index]) === null || _m === void 0 ? void 0 : _m.value) === null || _o === void 0 ? void 0 : _o.message, "data-testid": `label-value-${index}` },
                            React.createElement(AlertLabelDropdown, Object.assign({}, register(`labels.${index}.value`, {
                                required: { value: Boolean((_p = labels[index]) === null || _p === void 0 ? void 0 : _p.key), message: 'Required.' },
                            }), { defaultValue: field.value ? { label: field.value, value: field.value } : undefined, options: values, onChange: (newValue) => {
                                    setValue(`labels.${index}.value`, newValue.value);
                                }, onOpenMenu: () => {
                                    setSelectedKey(labels[index].key);
                                }, type: "value" }))),
                        React.createElement(RemoveButton, { className: styles.deleteLabelButton, index: index, remove: remove }))));
            }),
            React.createElement(AddButton, { className: styles.addLabelButton, append: append })))));
};
const LabelsWithoutSuggestions = () => {
    const styles = useStyles2(getStyles);
    const { register, control, watch, formState: { errors }, } = useFormContext();
    const labels = watch('labels');
    const { fields, remove, append } = useFieldArray({ control, name: 'labels' });
    return (React.createElement(React.Fragment, null,
        fields.map((field, index) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
            return (React.createElement("div", { key: field.id },
                React.createElement("div", { className: cx(styles.flexRow, styles.centerAlignRow), "data-testid": "alertlabel-input-wrapper" },
                    React.createElement(Field, { className: styles.labelInput, invalid: !!((_c = (_b = (_a = errors.labels) === null || _a === void 0 ? void 0 : _a[index]) === null || _b === void 0 ? void 0 : _b.key) === null || _c === void 0 ? void 0 : _c.message), error: (_f = (_e = (_d = errors.labels) === null || _d === void 0 ? void 0 : _d[index]) === null || _e === void 0 ? void 0 : _e.key) === null || _f === void 0 ? void 0 : _f.message },
                        React.createElement(Input, Object.assign({}, register(`labels.${index}.key`, {
                            required: { value: !!((_g = labels[index]) === null || _g === void 0 ? void 0 : _g.value), message: 'Required.' },
                        }), { placeholder: "key", "data-testid": `label-key-${index}`, defaultValue: field.key }))),
                    React.createElement(InlineLabel, { className: styles.equalSign }, "="),
                    React.createElement(Field, { className: styles.labelInput, invalid: !!((_k = (_j = (_h = errors.labels) === null || _h === void 0 ? void 0 : _h[index]) === null || _j === void 0 ? void 0 : _j.value) === null || _k === void 0 ? void 0 : _k.message), error: (_o = (_m = (_l = errors.labels) === null || _l === void 0 ? void 0 : _l[index]) === null || _m === void 0 ? void 0 : _m.value) === null || _o === void 0 ? void 0 : _o.message },
                        React.createElement(Input, Object.assign({}, register(`labels.${index}.value`, {
                            required: { value: !!((_p = labels[index]) === null || _p === void 0 ? void 0 : _p.key), message: 'Required.' },
                        }), { placeholder: "value", "data-testid": `label-value-${index}`, defaultValue: field.value }))),
                    React.createElement(RemoveButton, { className: styles.deleteLabelButton, index: index, remove: remove }))));
        }),
        React.createElement(AddButton, { className: styles.addLabelButton, append: append })));
};
const LabelsField = ({ dataSourceName }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", null,
        React.createElement(Label, { description: "A set of default labels is automatically added. Add additional labels as required." },
            React.createElement(Stack, { gap: 0.5, alignItems: "center" },
                React.createElement(Text, { variant: "bodySmall", color: "primary" }, "Labels"),
                React.createElement(Tooltip, { content: React.createElement("div", null, "The dropdown only displays labels that you have previously used for alerts. Select a label from the dropdown or type in a new one.") },
                    React.createElement(Icon, { className: styles.icon, name: "info-circle", size: "sm" })))),
        dataSourceName ? React.createElement(LabelsWithSuggestions, { dataSourceName: dataSourceName }) : React.createElement(LabelsWithoutSuggestions, null)));
};
const getStyles = (theme) => {
    return {
        icon: css `
      margin-right: ${theme.spacing(0.5)};
    `,
        flexColumn: css `
      display: flex;
      flex-direction: column;
    `,
        flexRow: css `
      display: flex;
      flex-direction: row;
      justify-content: flex-start;

      & + button {
        margin-left: ${theme.spacing(0.5)};
      }
    `,
        deleteLabelButton: css `
      margin-left: ${theme.spacing(0.5)};
      align-self: flex-start;
    `,
        addLabelButton: css `
      flex-grow: 0;
      align-self: flex-start;
    `,
        centerAlignRow: css `
      align-items: baseline;
    `,
        equalSign: css `
      align-self: flex-start;
      width: 28px;
      justify-content: center;
      margin-left: ${theme.spacing(0.5)};
    `,
        labelInput: css `
      width: 175px;
      margin-bottom: -${theme.spacing(1)};

      & + & {
        margin-left: ${theme.spacing(1)};
      }
    `,
    };
};
export default LabelsField;
//# sourceMappingURL=LabelsField.js.map