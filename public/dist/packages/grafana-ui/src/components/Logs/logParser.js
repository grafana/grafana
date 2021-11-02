import { __assign, __read, __spreadArray } from "tslib";
import { getParser } from '@grafana/data';
import memoizeOne from 'memoize-one';
import { MAX_CHARACTERS } from './LogRowMessage';
var memoizedGetParser = memoizeOne(getParser);
/**
 * Returns all fields for log row which consists of fields we parse from the message itself and any derived fields
 * setup in data source config.
 */
export var getAllFields = memoizeOne(function (row, getFieldLinks) {
    var fields = parseMessage(row.entry);
    var derivedFields = getDerivedFields(row, getFieldLinks);
    var fieldsMap = __spreadArray(__spreadArray([], __read(derivedFields), false), __read(fields), false).reduce(function (acc, field) {
        // Strip enclosing quotes for hashing. When values are parsed from log line the quotes are kept, but if same
        // value is in the dataFrame it will be without the quotes. We treat them here as the same value.
        var value = field.value.replace(/(^")|("$)/g, '');
        var fieldHash = field.key + "=" + value;
        if (acc[fieldHash]) {
            acc[fieldHash].links = __spreadArray(__spreadArray([], __read((acc[fieldHash].links || [])), false), __read((field.links || [])), false);
        }
        else {
            acc[fieldHash] = field;
        }
        return acc;
    }, {});
    var allFields = Object.values(fieldsMap);
    allFields.sort(sortFieldsLinkFirst);
    return allFields;
});
var parseMessage = memoizeOne(function (rowEntry) {
    if (rowEntry.length > MAX_CHARACTERS) {
        return [];
    }
    var parser = memoizedGetParser(rowEntry);
    if (!parser) {
        return [];
    }
    // Use parser to highlight detected fields
    var detectedFields = parser.getFields(rowEntry);
    var fields = detectedFields.map(function (field) {
        var key = parser.getLabelFromField(field);
        var value = parser.getValueFromField(field);
        return { key: key, value: value };
    });
    return fields;
});
var getDerivedFields = memoizeOne(function (row, getFieldLinks) {
    return (row.dataFrame.fields
        .map(function (field, index) { return (__assign(__assign({}, field), { index: index })); })
        // Remove Id which we use for react key and entry field which we are showing as the log message. Also remove hidden fields.
        .filter(function (field, index) { var _a; return !('id' === field.name || row.entryFieldIndex === index || ((_a = field.config.custom) === null || _a === void 0 ? void 0 : _a.hidden)); })
        // Filter out fields without values. For example in elastic the fields are parsed from the document which can
        // have different structure per row and so the dataframe is pretty sparse.
        .filter(function (field) {
        var value = field.values.get(row.rowIndex);
        // Not sure exactly what will be the empty value here. And we want to keep 0 as some values can be non
        // string.
        return value !== null && value !== undefined;
    })
        .map(function (field) {
        var links = getFieldLinks ? getFieldLinks(field, row.rowIndex) : [];
        return {
            key: field.name,
            value: field.values.get(row.rowIndex).toString(),
            links: links,
            fieldIndex: field.index,
        };
    }));
});
function sortFieldsLinkFirst(fieldA, fieldB) {
    var _a, _b, _c, _d;
    if (((_a = fieldA.links) === null || _a === void 0 ? void 0 : _a.length) && !((_b = fieldB.links) === null || _b === void 0 ? void 0 : _b.length)) {
        return -1;
    }
    if (!((_c = fieldA.links) === null || _c === void 0 ? void 0 : _c.length) && ((_d = fieldB.links) === null || _d === void 0 ? void 0 : _d.length)) {
        return 1;
    }
    return fieldA.key > fieldB.key ? 1 : fieldA.key < fieldB.key ? -1 : 0;
}
//# sourceMappingURL=logParser.js.map