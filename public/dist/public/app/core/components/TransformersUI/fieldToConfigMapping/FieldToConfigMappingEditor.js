import { __assign, __makeTemplateObject, __read, __spreadArray, __values } from "tslib";
import React from 'react';
import { getFieldDisplayName, ReducerID } from '@grafana/data';
import { Select, StatsPicker, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { configMapHandlers, evaluteFieldMappings, lookUpConfigHandler as findConfigHandlerFor, } from '../fieldToConfigMapping/fieldToConfigMapping';
import { capitalize } from 'lodash';
export function FieldToConfigMappingEditor(_a) {
    var frame = _a.frame, mappings = _a.mappings, onChange = _a.onChange, withReducers = _a.withReducers, withNameAndValue = _a.withNameAndValue;
    var styles = useStyles2(getStyles);
    var rows = getViewModelRows(frame, mappings, withNameAndValue);
    var configProps = configMapHandlers.map(function (def) { return configHandlerToSelectOption(def, false); });
    var onChangeConfigProperty = function (row, value) {
        var existingIdx = mappings.findIndex(function (x) { return x.fieldName === row.fieldName; });
        if (value) {
            if (existingIdx !== -1) {
                var update = __spreadArray([], __read(mappings), false);
                update.splice(existingIdx, 1, __assign(__assign({}, mappings[existingIdx]), { handlerKey: value.value }));
                onChange(update);
            }
            else {
                onChange(__spreadArray(__spreadArray([], __read(mappings), false), [{ fieldName: row.fieldName, handlerKey: value.value }], false));
            }
        }
        else {
            if (existingIdx !== -1) {
                onChange(mappings.filter(function (x, index) { return index !== existingIdx; }));
            }
            else {
                onChange(__spreadArray(__spreadArray([], __read(mappings), false), [{ fieldName: row.fieldName, handlerKey: '__ignore' }], false));
            }
        }
    };
    var onChangeReducer = function (row, reducerId) {
        var existingIdx = mappings.findIndex(function (x) { return x.fieldName === row.fieldName; });
        if (existingIdx !== -1) {
            var update = __spreadArray([], __read(mappings), false);
            update.splice(existingIdx, 1, __assign(__assign({}, mappings[existingIdx]), { reducerId: reducerId }));
            onChange(update);
        }
        else {
            onChange(__spreadArray(__spreadArray([], __read(mappings), false), [{ fieldName: row.fieldName, handlerKey: row.handlerKey, reducerId: reducerId }], false));
        }
    };
    return (React.createElement("table", { className: styles.table },
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null, "Field"),
                React.createElement("th", null, "Use as"),
                withReducers && React.createElement("th", null, "Select"))),
        React.createElement("tbody", null, rows.map(function (row) { return (React.createElement("tr", { key: row.fieldName },
            React.createElement("td", { className: styles.labelCell }, row.fieldName),
            React.createElement("td", { className: styles.selectCell, "data-testid": row.fieldName + "-config-key" },
                React.createElement(Select, { menuShouldPortal: true, options: configProps, value: row.configOption, placeholder: row.placeholder, isClearable: true, onChange: function (value) { return onChangeConfigProperty(row, value); } })),
            withReducers && (React.createElement("td", { "data-testid": row.fieldName + "-reducer", className: styles.selectCell },
                React.createElement(StatsPicker, { stats: [row.reducerId], defaultStat: row.reducerId, onChange: function (stats) { return onChangeReducer(row, stats[0]); } }))))); }))));
}
function getViewModelRows(frame, mappings, withNameAndValue) {
    var e_1, _a, e_2, _b;
    var _c, _d, _e;
    var rows = [];
    var mappingResult = evaluteFieldMappings(frame, mappings !== null && mappings !== void 0 ? mappings : [], withNameAndValue);
    try {
        for (var _f = __values(frame.fields), _g = _f.next(); !_g.done; _g = _f.next()) {
            var field = _g.value;
            var fieldName = getFieldDisplayName(field, frame);
            var mapping = mappingResult.index[fieldName];
            var option = configHandlerToSelectOption(mapping.handler, mapping.automatic);
            rows.push({
                fieldName: fieldName,
                configOption: mapping.automatic ? null : option,
                placeholder: mapping.automatic ? option === null || option === void 0 ? void 0 : option.label : 'Choose',
                handlerKey: (_d = (_c = mapping.handler) === null || _c === void 0 ? void 0 : _c.key) !== null && _d !== void 0 ? _d : null,
                reducerId: mapping.reducerId,
            });
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_g && !_g.done && (_a = _f.return)) _a.call(_f);
        }
        finally { if (e_1) throw e_1.error; }
    }
    var _loop_1 = function (mapping) {
        if (!rows.find(function (x) { return x.fieldName === mapping.fieldName; })) {
            var handler = findConfigHandlerFor(mapping.handlerKey);
            rows.push({
                fieldName: mapping.fieldName,
                handlerKey: mapping.handlerKey,
                configOption: configHandlerToSelectOption(handler, false),
                missingInFrame: true,
                reducerId: (_e = mapping.reducerId) !== null && _e !== void 0 ? _e : ReducerID.lastNotNull,
            });
        }
    };
    try {
        // Add rows for mappings that have no matching field
        for (var mappings_1 = __values(mappings), mappings_1_1 = mappings_1.next(); !mappings_1_1.done; mappings_1_1 = mappings_1.next()) {
            var mapping = mappings_1_1.value;
            _loop_1(mapping);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (mappings_1_1 && !mappings_1_1.done && (_b = mappings_1.return)) _b.call(mappings_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return Object.values(rows);
}
function configHandlerToSelectOption(def, isAutomatic) {
    var _a;
    if (!def) {
        return null;
    }
    var name = (_a = def.name) !== null && _a !== void 0 ? _a : capitalize(def.key);
    if (isAutomatic) {
        name = name + " (auto)";
    }
    return {
        label: name,
        value: def.key,
    };
}
var getStyles = function (theme) { return ({
    table: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-top: ", ";\n\n    td,\n    th {\n      border-right: 4px solid ", ";\n      border-bottom: 4px solid ", ";\n      white-space: nowrap;\n    }\n    th {\n      font-size: ", ";\n      line-height: ", ";\n      padding: ", ";\n    }\n  "], ["\n    margin-top: ", ";\n\n    td,\n    th {\n      border-right: 4px solid ", ";\n      border-bottom: 4px solid ", ";\n      white-space: nowrap;\n    }\n    th {\n      font-size: ", ";\n      line-height: ", ";\n      padding: ", ";\n    }\n  "])), theme.spacing(1), theme.colors.background.primary, theme.colors.background.primary, theme.typography.bodySmall.fontSize, theme.spacing(4), theme.spacing(0, 1)),
    labelCell: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    font-size: ", ";\n    background: ", ";\n    padding: ", ";\n    max-width: 400px;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    min-width: 140px;\n  "], ["\n    font-size: ", ";\n    background: ", ";\n    padding: ", ";\n    max-width: 400px;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    min-width: 140px;\n  "])), theme.typography.bodySmall.fontSize, theme.colors.background.secondary, theme.spacing(0, 1)),
    selectCell: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    padding: 0;\n    min-width: 161px;\n  "], ["\n    padding: 0;\n    min-width: 161px;\n  "]))),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=FieldToConfigMappingEditor.js.map