import { css } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';
import { useObservable } from 'react-use';
import { ComparisonOperation } from '@grafana/schema';
import { Button, InlineField, InlineFieldRow, Select, useStyles2 } from '@grafana/ui';
import { comparisonOperationOptions } from '@grafana/ui/src/components/MatchersUI/FieldValueMatcher';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
import { DEFAULT_STYLE_RULE } from '../layers/data/geojsonLayer';
import { defaultStyleConfig } from '../style/types';
import { getUniqueFeatureValues } from '../utils/getFeatures';
import { getSelectionInfo } from '../utils/selection';
import { StyleEditor } from './StyleEditor';
export const StyleRuleEditor = ({ value, onChange, item, context }) => {
    var _a, _b;
    const settings = item.settings;
    const { features, layerInfo } = settings;
    const propertyOptions = useObservable(layerInfo);
    const feats = useObservable(features);
    const uniqueSelectables = useMemo(() => {
        var _a, _b;
        const key = (_a = value === null || value === void 0 ? void 0 : value.check) === null || _a === void 0 ? void 0 : _a.property;
        if (key && feats && ((_b = value.check) === null || _b === void 0 ? void 0 : _b.operation) === ComparisonOperation.EQ) {
            return getUniqueFeatureValues(feats, key).map((v) => {
                let newValue;
                let isNewValueNumber = !isNaN(Number(v));
                if (isNewValueNumber) {
                    newValue = {
                        value: Number(v),
                        label: v,
                    };
                }
                else {
                    newValue = { value: v, label: v };
                }
                return newValue;
            });
        }
        return [];
    }, [feats, value]);
    const styles = useStyles2(getStyles);
    const LABEL_WIDTH = 10;
    const onChangeProperty = useCallback((selection) => {
        onChange(Object.assign(Object.assign({}, value), { check: Object.assign(Object.assign({}, value.check), { property: selection === null || selection === void 0 ? void 0 : selection.value }) }));
    }, [onChange, value]);
    const onChangeComparison = useCallback((selection) => {
        var _a;
        onChange(Object.assign(Object.assign({}, value), { check: Object.assign(Object.assign({}, value.check), { operation: (_a = selection.value) !== null && _a !== void 0 ? _a : ComparisonOperation.EQ }) }));
    }, [onChange, value]);
    const onChangeValue = useCallback((selection) => {
        onChange(Object.assign(Object.assign({}, value), { check: Object.assign(Object.assign({}, value.check), { value: selection === null || selection === void 0 ? void 0 : selection.value }) }));
    }, [onChange, value]);
    const onChangeNumericValue = useCallback((v) => {
        onChange(Object.assign(Object.assign({}, value), { check: Object.assign(Object.assign({}, value.check), { value: v }) }));
    }, [onChange, value]);
    const onChangeStyle = useCallback((style) => {
        onChange(Object.assign(Object.assign({}, value), { style }));
    }, [onChange, value]);
    const onDelete = useCallback(() => {
        onChange(undefined);
    }, [onChange]);
    const check = (_a = value.check) !== null && _a !== void 0 ? _a : DEFAULT_STYLE_RULE.check;
    const propv = getSelectionInfo(check.property, propertyOptions === null || propertyOptions === void 0 ? void 0 : propertyOptions.propertes);
    const valuev = getSelectionInfo(check.value, uniqueSelectables);
    return (React.createElement("div", { className: styles.rule },
        React.createElement(InlineFieldRow, { className: styles.row },
            React.createElement(InlineField, { label: "Rule", labelWidth: LABEL_WIDTH, grow: true },
                React.createElement(Select, { placeholder: 'Feature property', value: propv.current, options: propv.options, onChange: onChangeProperty, "aria-label": 'Feature property', isClearable: true, allowCustomValue: true })),
            React.createElement(InlineField, { className: styles.inline },
                React.createElement(Select, { value: comparisonOperationOptions.find((v) => v.value === check.operation), options: comparisonOperationOptions, onChange: onChangeComparison, "aria-label": 'Comparison operator', width: 8 })),
            React.createElement(InlineField, { className: styles.inline, grow: true },
                React.createElement("div", { className: styles.flexRow },
                    (check.operation === ComparisonOperation.EQ || check.operation === ComparisonOperation.NEQ) && (React.createElement(Select, { placeholder: 'value', value: valuev.current, options: valuev.options, onChange: onChangeValue, "aria-label": 'Comparison value', isClearable: true, allowCustomValue: true })),
                    check.operation !== ComparisonOperation.EQ && (React.createElement(NumberInput, { key: `${check.property}/${check.operation}`, value: !isNaN(Number(check.value)) ? Number(check.value) : 0, placeholder: "numeric value", onChange: onChangeNumericValue })))),
            React.createElement(Button, { size: "md", icon: "trash-alt", onClick: () => onDelete(), variant: "secondary", "aria-label": 'Delete style rule', className: styles.button })),
        React.createElement("div", null,
            React.createElement(StyleEditor, { value: (_b = value.style) !== null && _b !== void 0 ? _b : defaultStyleConfig, context: context, onChange: onChangeStyle, item: {
                    settings: {
                        simpleFixedValues: true,
                        layerInfo,
                    },
                } }))));
};
const getStyles = (theme) => ({
    rule: css({
        marginBottom: theme.spacing(1),
    }),
    row: css({
        display: 'flex',
        marginBottom: '4px',
    }),
    inline: css({
        marginBottom: 0,
        marginLeft: '4px',
    }),
    button: css({
        marginLeft: '4px',
    }),
    flexRow: css({
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
    }),
});
//# sourceMappingURL=StyleRuleEditor.js.map