import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import React from 'react';
import { getFieldDisplayName, ReducerID } from '@grafana/data';
import { Select, StatsPicker, useStyles2 } from '@grafana/ui';
import { configMapHandlers, evaluteFieldMappings, lookUpConfigHandler as findConfigHandlerFor, } from '../fieldToConfigMapping/fieldToConfigMapping';
export function FieldToConfigMappingEditor({ frame, mappings, onChange, withReducers, withNameAndValue }) {
    const styles = useStyles2(getStyles);
    const rows = getViewModelRows(frame, mappings, withNameAndValue);
    const configProps = configMapHandlers.map((def) => configHandlerToSelectOption(def, false));
    const onChangeConfigProperty = (row, value) => {
        const existingIdx = mappings.findIndex((x) => x.fieldName === row.fieldName);
        if (value) {
            if (existingIdx !== -1) {
                const update = [...mappings];
                update.splice(existingIdx, 1, Object.assign(Object.assign({}, mappings[existingIdx]), { handlerKey: value.value }));
                onChange(update);
            }
            else {
                onChange([...mappings, { fieldName: row.fieldName, handlerKey: value.value }]);
            }
        }
        else {
            if (existingIdx !== -1) {
                onChange(mappings.filter((x, index) => index !== existingIdx));
            }
            else {
                onChange([...mappings, { fieldName: row.fieldName, handlerKey: '__ignore' }]);
            }
        }
    };
    const onChangeReducer = (row, reducerId) => {
        const existingIdx = mappings.findIndex((x) => x.fieldName === row.fieldName);
        if (existingIdx !== -1) {
            const update = [...mappings];
            update.splice(existingIdx, 1, Object.assign(Object.assign({}, mappings[existingIdx]), { reducerId }));
            onChange(update);
        }
        else {
            onChange([...mappings, { fieldName: row.fieldName, handlerKey: row.handlerKey, reducerId }]);
        }
    };
    return (React.createElement("table", { className: styles.table },
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null, "Field"),
                React.createElement("th", null, "Use as"),
                withReducers && React.createElement("th", null, "Select"))),
        React.createElement("tbody", null, rows.map((row) => (React.createElement("tr", { key: row.fieldName },
            React.createElement("td", { className: styles.labelCell }, row.fieldName),
            React.createElement("td", { className: styles.selectCell, "data-testid": `${row.fieldName}-config-key` },
                React.createElement(Select, { options: configProps, value: row.configOption, placeholder: row.placeholder, isClearable: true, onChange: (value) => onChangeConfigProperty(row, value) })),
            withReducers && (React.createElement("td", { "data-testid": `${row.fieldName}-reducer`, className: styles.selectCell },
                React.createElement(StatsPicker, { stats: [row.reducerId], defaultStat: row.reducerId, onChange: (stats) => onChangeReducer(row, stats[0]) })))))))));
}
function getViewModelRows(frame, mappings, withNameAndValue) {
    var _a, _b, _c;
    const rows = [];
    const mappingResult = evaluteFieldMappings(frame, mappings !== null && mappings !== void 0 ? mappings : [], withNameAndValue);
    for (const field of frame.fields) {
        const fieldName = getFieldDisplayName(field, frame);
        const mapping = mappingResult.index[fieldName];
        const option = configHandlerToSelectOption(mapping.handler, mapping.automatic);
        rows.push({
            fieldName,
            configOption: mapping.automatic ? null : option,
            placeholder: mapping.automatic ? option === null || option === void 0 ? void 0 : option.label : 'Choose',
            handlerKey: (_b = (_a = mapping.handler) === null || _a === void 0 ? void 0 : _a.key) !== null && _b !== void 0 ? _b : null,
            reducerId: mapping.reducerId,
        });
    }
    // Add rows for mappings that have no matching field
    for (const mapping of mappings) {
        if (!rows.find((x) => x.fieldName === mapping.fieldName)) {
            const handler = findConfigHandlerFor(mapping.handlerKey);
            rows.push({
                fieldName: mapping.fieldName,
                handlerKey: mapping.handlerKey,
                configOption: configHandlerToSelectOption(handler, false),
                missingInFrame: true,
                reducerId: (_c = mapping.reducerId) !== null && _c !== void 0 ? _c : ReducerID.lastNotNull,
            });
        }
    }
    return Object.values(rows);
}
function configHandlerToSelectOption(def, isAutomatic) {
    var _a;
    if (!def) {
        return null;
    }
    let name = (_a = def.name) !== null && _a !== void 0 ? _a : capitalize(def.key);
    if (isAutomatic) {
        name = `${name} (auto)`;
    }
    return {
        label: name,
        value: def.key,
    };
}
const getStyles = (theme) => ({
    table: css `
    margin-top: ${theme.spacing(1)};

    td,
    th {
      border-right: 4px solid ${theme.colors.background.primary};
      border-bottom: 4px solid ${theme.colors.background.primary};
      white-space: nowrap;
    }
    th {
      font-size: ${theme.typography.bodySmall.fontSize};
      line-height: ${theme.spacing(4)};
      padding: ${theme.spacing(0, 1)};
    }
  `,
    labelCell: css `
    font-size: ${theme.typography.bodySmall.fontSize};
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(0, 1)};
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 140px;
  `,
    selectCell: css `
    padding: 0;
    min-width: 161px;
  `,
});
//# sourceMappingURL=FieldToConfigMappingEditor.js.map