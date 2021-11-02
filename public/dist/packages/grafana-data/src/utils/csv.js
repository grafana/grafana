import { __assign, __values } from "tslib";
// Libraries
import Papa from 'papaparse';
import { defaults } from 'lodash';
// Types
import { FieldType } from '../types';
import { guessFieldTypeFromValue } from '../dataframe/processDataFrame';
import { MutableDataFrame } from '../dataframe/MutableDataFrame';
import { getFieldDisplayName } from '../field';
import { formattedValueToString } from '../valueFormats';
export var CSVHeaderStyle;
(function (CSVHeaderStyle) {
    CSVHeaderStyle[CSVHeaderStyle["full"] = 0] = "full";
    CSVHeaderStyle[CSVHeaderStyle["name"] = 1] = "name";
    CSVHeaderStyle[CSVHeaderStyle["none"] = 2] = "none";
})(CSVHeaderStyle || (CSVHeaderStyle = {}));
export function readCSV(csv, options) {
    return new CSVReader(options).readCSV(csv);
}
var ParseState;
(function (ParseState) {
    ParseState[ParseState["Starting"] = 0] = "Starting";
    ParseState[ParseState["InHeader"] = 1] = "InHeader";
    ParseState[ParseState["ReadingRows"] = 2] = "ReadingRows";
})(ParseState || (ParseState = {}));
var CSVReader = /** @class */ (function () {
    function CSVReader(options) {
        var _this = this;
        // PapaParse callback on each line
        this.chunk = function (results, parser) {
            var e_1, _a;
            for (var i = 0; i < results.data.length; i++) {
                var line = results.data[i];
                if (line.length < 1) {
                    continue;
                }
                var first = line[0]; // null or value, papaparse does not return ''
                if (first) {
                    // Comment or header queue
                    if (first.startsWith('#')) {
                        // Look for special header column
                        // #{columkey}#a,b,c
                        var idx = first.indexOf('#', 2);
                        if (idx > 0) {
                            var k = first.substr(1, idx - 1);
                            var isName = 'name' === k;
                            // Simple object used to check if headers match
                            var headerKeys = {
                                unit: '#',
                            };
                            // Check if it is a known/supported column
                            if (isName || headerKeys.hasOwnProperty(k)) {
                                // Starting a new table after reading rows
                                if (_this.state === ParseState.ReadingRows) {
                                    _this.current = new MutableDataFrame({ fields: [] });
                                    _this.data.push(_this.current);
                                }
                                var v = first.substr(idx + 1);
                                if (isName) {
                                    _this.current.addFieldFor(undefined, v);
                                    for (var j = 1; j < line.length; j++) {
                                        _this.current.addFieldFor(undefined, line[j]);
                                    }
                                }
                                else {
                                    var fields = _this.current.fields;
                                    for (var j = 0; j < fields.length; j++) {
                                        if (!fields[j].config) {
                                            fields[j].config = {};
                                        }
                                        var disp = fields[j].config; // any lets name lookup
                                        disp[k] = j === 0 ? v : line[j];
                                    }
                                }
                                _this.state = ParseState.InHeader;
                                continue;
                            }
                        }
                        else if (_this.state === ParseState.Starting) {
                            _this.state = ParseState.InHeader;
                            continue;
                        }
                        // Ignore comment lines
                        continue;
                    }
                    if (_this.state === ParseState.Starting) {
                        var type = guessFieldTypeFromValue(first);
                        if (type === FieldType.string) {
                            try {
                                for (var line_1 = (e_1 = void 0, __values(line)), line_1_1 = line_1.next(); !line_1_1.done; line_1_1 = line_1.next()) {
                                    var s = line_1_1.value;
                                    _this.current.addFieldFor(undefined, s);
                                }
                            }
                            catch (e_1_1) { e_1 = { error: e_1_1 }; }
                            finally {
                                try {
                                    if (line_1_1 && !line_1_1.done && (_a = line_1.return)) _a.call(line_1);
                                }
                                finally { if (e_1) throw e_1.error; }
                            }
                            _this.state = ParseState.InHeader;
                            continue;
                        }
                        _this.state = ParseState.InHeader; // fall through to read rows
                    }
                }
                // Add the current results to the data
                if (_this.state !== ParseState.ReadingRows) {
                    // anything???
                }
                _this.state = ParseState.ReadingRows;
                // Make sure column structure is valid
                if (line.length > _this.current.fields.length) {
                    var fields = _this.current.fields;
                    for (var f = fields.length; f < line.length; f++) {
                        _this.current.addFieldFor(line[f]);
                    }
                    if (_this.callback) {
                        _this.callback.onHeader(_this.current.fields);
                    }
                }
                _this.current.appendRow(line);
                if (_this.callback) {
                    // // Send the header after we guess the type
                    // if (this.series.rows.length === 0) {
                    //   this.callback.onHeader(this.series);
                    // }
                    _this.callback.onRow(line);
                }
            }
        };
        if (!options) {
            options = {};
        }
        this.config = options.config || {};
        this.callback = options.callback;
        this.current = new MutableDataFrame({ fields: [] });
        this.state = ParseState.Starting;
        this.data = [];
    }
    CSVReader.prototype.readCSV = function (text) {
        this.current = new MutableDataFrame({ fields: [] });
        this.data = [this.current];
        var papacfg = __assign(__assign({}, this.config), { dynamicTyping: false, skipEmptyLines: true, comments: false, chunk: this.chunk });
        Papa.parse(text, papacfg);
        return this.data;
    };
    return CSVReader;
}());
export { CSVReader };
function writeValue(value, config) {
    var str = value.toString();
    if (str.includes('"')) {
        // Escape the double quote characters
        return config.quoteChar + str.replace(/"/gi, '""') + config.quoteChar;
    }
    if (str.includes('\n') || str.includes(config.delimiter)) {
        return config.quoteChar + str + config.quoteChar;
    }
    return str;
}
function makeFieldWriter(field, config) {
    if (field.display) {
        return function (value) {
            var displayValue = field.display(value);
            return writeValue(formattedValueToString(displayValue), config);
        };
    }
    return function (value) { return writeValue(value, config); };
}
function getHeaderLine(key, fields, config) {
    var e_2, _a;
    var isName = 'name' === key;
    var isType = 'type' === key;
    try {
        for (var fields_1 = __values(fields), fields_1_1 = fields_1.next(); !fields_1_1.done; fields_1_1 = fields_1.next()) {
            var f = fields_1_1.value;
            var display = f.config;
            if (isName || isType || (display && display.hasOwnProperty(key))) {
                var line = '#' + key + '#';
                for (var i = 0; i < fields.length; i++) {
                    if (i > 0) {
                        line = line + config.delimiter;
                    }
                    var v = fields[i].name;
                    if (isType) {
                        v = fields[i].type;
                    }
                    else if (isName) {
                        // already name
                    }
                    else {
                        v = fields[i].config[key];
                    }
                    if (v) {
                        line = line + writeValue(v, config);
                    }
                }
                return line + config.newline;
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (fields_1_1 && !fields_1_1.done && (_a = fields_1.return)) _a.call(fields_1);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return '';
}
function getLocaleDelimiter() {
    var arr = ['x', 'y'];
    if (arr.toLocaleString) {
        return arr.toLocaleString().charAt(1);
    }
    return ',';
}
export function toCSV(data, config) {
    var e_3, _a;
    if (!data) {
        return '';
    }
    config = defaults(config, {
        delimiter: getLocaleDelimiter(),
        newline: '\r\n',
        quoteChar: '"',
        encoding: '',
        headerStyle: CSVHeaderStyle.name,
        useExcelHeader: false,
    });
    var csv = config.useExcelHeader ? "sep=" + config.delimiter + config.newline : '';
    try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var series = data_1_1.value;
            var fields = series.fields;
            // ignore frames with no fields
            if (fields.length === 0) {
                continue;
            }
            if (config.headerStyle === CSVHeaderStyle.full) {
                csv =
                    csv +
                        getHeaderLine('name', fields, config) +
                        getHeaderLine('type', fields, config) +
                        getHeaderLine('unit', fields, config) +
                        getHeaderLine('dateFormat', fields, config);
            }
            else if (config.headerStyle === CSVHeaderStyle.name) {
                for (var i = 0; i < fields.length; i++) {
                    if (i > 0) {
                        csv += config.delimiter;
                    }
                    csv += "\"" + getFieldDisplayName(fields[i], series).replace(/"/g, '""') + "\"";
                }
                csv += config.newline;
            }
            var length_1 = fields[0].values.length;
            if (length_1 > 0) {
                var writers = fields.map(function (field) { return makeFieldWriter(field, config); });
                for (var i = 0; i < length_1; i++) {
                    for (var j = 0; j < fields.length; j++) {
                        if (j > 0) {
                            csv = csv + config.delimiter;
                        }
                        var v = fields[j].values.get(i);
                        if (v !== null) {
                            csv = csv + writers[j](v);
                        }
                    }
                    csv = csv + config.newline;
                }
            }
            csv = csv + config.newline;
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return csv;
}
//# sourceMappingURL=csv.js.map