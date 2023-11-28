import { partition } from 'lodash';
import memoizeOne from 'memoize-one';
import { safeStringifyValue } from 'app/core/utils/explore';
import { parseLogsFrame } from '../logsFrame';
/**
 * Returns all fields for log row which consists of fields we parse from the message itself and additional fields
 * found in the dataframe (they may contain links).
 */
export const getAllFields = memoizeOne((row, getFieldLinks) => {
    const dataframeFields = getDataframeFields(row, getFieldLinks);
    return Object.values(dataframeFields);
});
/**
 * A log line may contain many links that would all need to go on their own logs detail row
 * This iterates through and creates a FieldDef (row) per link.
 */
export const createLogLineLinks = memoizeOne((hiddenFieldsWithLinks) => {
    let fieldsWithLinksFromVariableMap = [];
    hiddenFieldsWithLinks.forEach((linkField) => {
        var _a;
        (_a = linkField.links) === null || _a === void 0 ? void 0 : _a.forEach((link) => {
            if (link.variables) {
                const variableKeys = link.variables.map((variable) => {
                    const varName = variable.variableName;
                    const fieldPath = variable.fieldPath ? `.${variable.fieldPath}` : '';
                    return `${varName}${fieldPath}`;
                });
                const variableValues = link.variables.map((variable) => (variable.found ? variable.value : ''));
                fieldsWithLinksFromVariableMap.push({
                    keys: variableKeys,
                    values: variableValues,
                    links: [link],
                    fieldIndex: linkField.fieldIndex,
                });
            }
        });
    });
    return fieldsWithLinksFromVariableMap;
});
/**
 * creates fields from the dataframe-fields, adding data-links, when field.config.links exists
 */
export const getDataframeFields = memoizeOne((row, getFieldLinks) => {
    const visibleFields = separateVisibleFields(row.dataFrame).visible;
    const nonEmptyVisibleFields = visibleFields.filter((f) => f.values[row.rowIndex] != null);
    return nonEmptyVisibleFields.map((field) => {
        const links = getFieldLinks ? getFieldLinks(field, row.rowIndex, row.dataFrame) : [];
        const fieldVal = field.values[row.rowIndex];
        const outputVal = typeof fieldVal === 'string' || typeof fieldVal === 'number'
            ? fieldVal.toString()
            : safeStringifyValue(fieldVal);
        return {
            keys: [field.name],
            values: [outputVal],
            links: links,
            fieldIndex: field.index,
        };
    });
});
// return the fields (their indices to be exact) that should be visible
// based on the logs dataframe structure
function getVisibleFieldIndices(frame, opts) {
    const logsFrame = parseLogsFrame(frame);
    if (logsFrame === null) {
        // should not really happen
        return new Set();
    }
    // we want to show every "extra" field
    const visibleFieldIndices = new Set(logsFrame.extraFields.map((f) => f.index));
    // we always show the severity field
    if (logsFrame.severityField !== null) {
        visibleFieldIndices.add(logsFrame.severityField.index);
    }
    if (opts.keepBody) {
        visibleFieldIndices.add(logsFrame.bodyField.index);
    }
    if (opts.keepTimestamp) {
        visibleFieldIndices.add(logsFrame.timeField.index);
    }
    return visibleFieldIndices;
}
// split the dataframe's fields into visible and hidden arrays.
// note: does not do any row-level checks,
// for example does not check if the field's values are nullish
// or not at a givn row.
export function separateVisibleFields(frame, opts) {
    const fieldsWithIndex = frame.fields.map((field, index) => (Object.assign(Object.assign({}, field), { index })));
    const visibleFieldIndices = getVisibleFieldIndices(frame, opts !== null && opts !== void 0 ? opts : {});
    const [visible, hidden] = partition(fieldsWithIndex, (f) => {
        var _a, _b;
        // hidden fields are always hidden
        if ((_a = f.config.custom) === null || _a === void 0 ? void 0 : _a.hidden) {
            return false;
        }
        // fields with data-links are visible
        if (((_b = f.config.links) !== null && _b !== void 0 ? _b : []).length > 0) {
            return true;
        }
        return visibleFieldIndices.has(f.index);
    });
    return { visible, hidden };
}
//# sourceMappingURL=logParser.js.map