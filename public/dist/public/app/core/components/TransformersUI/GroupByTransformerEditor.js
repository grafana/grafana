import { __assign, __makeTemplateObject } from "tslib";
import React, { useCallback } from 'react';
import { css, cx } from '@emotion/css';
import { DataTransformerID, standardTransformers, } from '@grafana/data';
import { Select, StatsPicker, stylesFactory } from '@grafana/ui';
import { GroupByOperationID, } from '@grafana/data/src/transformations/transformers/groupBy';
import { useAllFieldNamesFromDataFrames } from './utils';
export var GroupByTransformerEditor = function (_a) {
    var input = _a.input, options = _a.options, onChange = _a.onChange;
    var fieldNames = useAllFieldNamesFromDataFrames(input);
    var onConfigChange = useCallback(function (fieldName) { return function (config) {
        var _a;
        onChange(__assign(__assign({}, options), { fields: __assign(__assign({}, options.fields), (_a = {}, _a[fieldName] = config, _a)) }));
    }; }, 
    // Adding options to the dependency array causes infinite loop here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange]);
    return (React.createElement("div", null, fieldNames.map(function (key) { return (React.createElement(GroupByFieldConfiguration, { onConfigChange: onConfigChange(key), fieldName: key, config: options.fields[key], key: key })); })));
};
var options = [
    { label: 'Group by', value: GroupByOperationID.groupBy },
    { label: 'Calculate', value: GroupByOperationID.aggregate },
];
export var GroupByFieldConfiguration = function (_a) {
    var fieldName = _a.fieldName, config = _a.config, onConfigChange = _a.onConfigChange;
    var styles = getStyling();
    var onChange = useCallback(function (value) {
        var _a, _b;
        onConfigChange({
            aggregations: (_a = config === null || config === void 0 ? void 0 : config.aggregations) !== null && _a !== void 0 ? _a : [],
            operation: (_b = value === null || value === void 0 ? void 0 : value.value) !== null && _b !== void 0 ? _b : null,
        });
    }, [config, onConfigChange]);
    return (React.createElement("div", { className: cx('gf-form-inline', styles.row) },
        React.createElement("div", { className: cx('gf-form', styles.fieldName) },
            React.createElement("div", { className: cx('gf-form-label', styles.rowSpacing) }, fieldName)),
        React.createElement("div", { className: cx('gf-form', styles.cell) },
            React.createElement("div", { className: cx('gf-form-spacing', styles.rowSpacing) },
                React.createElement(Select, { menuShouldPortal: true, className: "width-12", options: options, value: config === null || config === void 0 ? void 0 : config.operation, placeholder: "Ignored", onChange: onChange, isClearable: true }))),
        (config === null || config === void 0 ? void 0 : config.operation) === GroupByOperationID.aggregate && (React.createElement("div", { className: cx('gf-form', 'gf-form--grow', styles.calculations) },
            React.createElement(StatsPicker, { className: cx('flex-grow-1', styles.rowSpacing), placeholder: "Select Stats", allowMultiple: true, stats: config.aggregations, onChange: function (stats) {
                    onConfigChange(__assign(__assign({}, config), { aggregations: stats }));
                } })))));
};
var getStyling = stylesFactory(function () {
    var cell = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    display: table-cell;\n  "], ["\n    display: table-cell;\n  "])));
    return {
        row: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      display: table-row;\n    "], ["\n      display: table-row;\n    "]))),
        cell: cell,
        rowSpacing: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      margin-bottom: 4px;\n    "], ["\n      margin-bottom: 4px;\n    "]))),
        fieldName: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      ", "\n      min-width: 250px;\n      white-space: nowrap;\n    "], ["\n      ", "\n      min-width: 250px;\n      white-space: nowrap;\n    "])), cell),
        calculations: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n      ", "\n      width: 99%;\n    "], ["\n      ", "\n      width: 99%;\n    "])), cell),
    };
});
export var groupByTransformRegistryItem = {
    id: DataTransformerID.groupBy,
    editor: GroupByTransformerEditor,
    transformation: standardTransformers.groupByTransformer,
    name: standardTransformers.groupByTransformer.name,
    description: standardTransformers.groupByTransformer.description,
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=GroupByTransformerEditor.js.map