import kbn from 'app/core/utils/kbn';
import { dateTime, Registry, textUtil } from '@grafana/data';
import { isArray, map, replace } from 'lodash';
import { formatVariableLabel } from '../variables/shared/formatVariable';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../variables/state/types';
import { variableAdapters } from '../variables/adapters';
export var FormatRegistryID;
(function (FormatRegistryID) {
    FormatRegistryID["lucene"] = "lucene";
    FormatRegistryID["raw"] = "raw";
    FormatRegistryID["regex"] = "regex";
    FormatRegistryID["pipe"] = "pipe";
    FormatRegistryID["distributed"] = "distributed";
    FormatRegistryID["csv"] = "csv";
    FormatRegistryID["html"] = "html";
    FormatRegistryID["json"] = "json";
    FormatRegistryID["percentEncode"] = "percentencode";
    FormatRegistryID["singleQuote"] = "singlequote";
    FormatRegistryID["doubleQuote"] = "doublequote";
    FormatRegistryID["sqlString"] = "sqlstring";
    FormatRegistryID["date"] = "date";
    FormatRegistryID["glob"] = "glob";
    FormatRegistryID["text"] = "text";
    FormatRegistryID["queryParam"] = "queryparam";
})(FormatRegistryID || (FormatRegistryID = {}));
export var formatRegistry = new Registry(function () {
    var formats = [
        {
            id: FormatRegistryID.lucene,
            name: 'Lucene',
            description: 'Values are lucene escaped and multi-valued variables generate an OR expression',
            formatter: function (_a) {
                var value = _a.value;
                if (typeof value === 'string') {
                    return luceneEscape(value);
                }
                if (value instanceof Array && value.length === 0) {
                    return '__empty__';
                }
                var quotedValues = map(value, function (val) {
                    return '"' + luceneEscape(val) + '"';
                });
                return '(' + quotedValues.join(' OR ') + ')';
            },
        },
        {
            id: FormatRegistryID.raw,
            name: 'raw',
            description: 'Keep value as is',
            formatter: function (_a) {
                var value = _a.value;
                return value;
            },
        },
        {
            id: FormatRegistryID.regex,
            name: 'Regex',
            description: 'Values are regex escaped and multi-valued variables generate a (<value>|<value>) expression',
            formatter: function (_a) {
                var value = _a.value;
                if (typeof value === 'string') {
                    return kbn.regexEscape(value);
                }
                var escapedValues = map(value, kbn.regexEscape);
                if (escapedValues.length === 1) {
                    return escapedValues[0];
                }
                return '(' + escapedValues.join('|') + ')';
            },
        },
        {
            id: FormatRegistryID.pipe,
            name: 'Pipe',
            description: 'Values are separated by | character',
            formatter: function (_a) {
                var value = _a.value;
                if (typeof value === 'string') {
                    return value;
                }
                return value.join('|');
            },
        },
        {
            id: FormatRegistryID.distributed,
            name: 'Distributed',
            description: 'Multiple values are formatted like variable=value',
            formatter: function (_a, variable) {
                var value = _a.value;
                if (typeof value === 'string') {
                    return value;
                }
                value = map(value, function (val, index) {
                    if (index !== 0) {
                        return variable.name + '=' + val;
                    }
                    else {
                        return val;
                    }
                });
                return value.join(',');
            },
        },
        {
            id: FormatRegistryID.csv,
            name: 'Csv',
            description: 'Comma-separated values',
            formatter: function (_a) {
                var value = _a.value;
                if (isArray(value)) {
                    return value.join(',');
                }
                return value;
            },
        },
        {
            id: FormatRegistryID.html,
            name: 'HTML',
            description: 'HTML escaping of values',
            formatter: function (_a) {
                var value = _a.value;
                if (isArray(value)) {
                    return textUtil.escapeHtml(value.join(', '));
                }
                return textUtil.escapeHtml(value);
            },
        },
        {
            id: FormatRegistryID.json,
            name: 'JSON',
            description: 'JSON stringify valu',
            formatter: function (_a) {
                var value = _a.value;
                return JSON.stringify(value);
            },
        },
        {
            id: FormatRegistryID.percentEncode,
            name: 'Percent encode',
            description: 'Useful for URL escaping values',
            formatter: function (_a) {
                var value = _a.value;
                // like glob, but url escaped
                if (isArray(value)) {
                    return encodeURIComponentStrict('{' + value.join(',') + '}');
                }
                return encodeURIComponentStrict(value);
            },
        },
        {
            id: FormatRegistryID.singleQuote,
            name: 'Single quote',
            description: 'Single quoted values',
            formatter: function (_a) {
                var value = _a.value;
                // escape single quotes with backslash
                var regExp = new RegExp("'", 'g');
                if (isArray(value)) {
                    return map(value, function (v) { return "'" + replace(v, regExp, "\\'") + "'"; }).join(',');
                }
                return "'" + replace(value, regExp, "\\'") + "'";
            },
        },
        {
            id: FormatRegistryID.doubleQuote,
            name: 'Double quote',
            description: 'Double quoted values',
            formatter: function (_a) {
                var value = _a.value;
                // escape double quotes with backslash
                var regExp = new RegExp('"', 'g');
                if (isArray(value)) {
                    return map(value, function (v) { return "\"" + replace(v, regExp, '\\"') + "\""; }).join(',');
                }
                return "\"" + replace(value, regExp, '\\"') + "\"";
            },
        },
        {
            id: FormatRegistryID.sqlString,
            name: 'SQL string',
            description: 'SQL string quoting and commas for use in IN statements and other scenarios',
            formatter: function (_a) {
                var value = _a.value;
                // escape single quotes by pairing them
                var regExp = new RegExp("'", 'g');
                if (isArray(value)) {
                    return map(value, function (v) { return "'" + replace(v, regExp, "''") + "'"; }).join(',');
                }
                return "'" + replace(value, regExp, "''") + "'";
            },
        },
        {
            id: FormatRegistryID.date,
            name: 'Date',
            description: 'Format date in different ways',
            formatter: function (_a) {
                var _b;
                var value = _a.value, args = _a.args;
                var arg = (_b = args[0]) !== null && _b !== void 0 ? _b : 'iso';
                switch (arg) {
                    case 'ms':
                        return value;
                    case 'seconds':
                        return "" + Math.round(parseInt(value, 10) / 1000);
                    case 'iso':
                        return dateTime(parseInt(value, 10)).toISOString();
                    default:
                        return dateTime(parseInt(value, 10)).format(arg);
                }
            },
        },
        {
            id: FormatRegistryID.glob,
            name: 'Glob',
            description: 'Format multi-valued variables using glob syntax, example {value1,value2}',
            formatter: function (_a) {
                var value = _a.value;
                if (isArray(value) && value.length > 1) {
                    return '{' + value.join(',') + '}';
                }
                return value;
            },
        },
        {
            id: FormatRegistryID.text,
            name: 'Text',
            description: 'Format variables in their text representation. Example in multi-variable scenario A + B + C.',
            formatter: function (options, variable) {
                var _a;
                if (typeof options.text === 'string') {
                    return options.value === ALL_VARIABLE_VALUE ? ALL_VARIABLE_TEXT : options.text;
                }
                var current = (_a = variable) === null || _a === void 0 ? void 0 : _a.current;
                if (!current) {
                    return options.value;
                }
                return formatVariableLabel(variable);
            },
        },
        {
            id: FormatRegistryID.queryParam,
            name: 'Query parameter',
            description: 'Format variables as URL parameters. Example in multi-variable scenario A + B + C => var-foo=A&var-foo=B&var-foo=C.',
            formatter: function (options, variable) {
                var name = variable.name, type = variable.type;
                var adapter = variableAdapters.get(type);
                var valueForUrl = adapter.getValueForUrl(variable);
                if (Array.isArray(valueForUrl)) {
                    return valueForUrl.map(function (v) { return formatQueryParameter(name, v); }).join('&');
                }
                return formatQueryParameter(name, valueForUrl);
            },
        },
    ];
    return formats;
});
function luceneEscape(value) {
    return value.replace(/([\!\*\+\-\=<>\s\&\|\(\)\[\]\{\}\^\~\?\:\\/"])/g, '\\$1');
}
/**
 * encode string according to RFC 3986; in contrast to encodeURIComponent()
 * also the sub-delims "!", "'", "(", ")" and "*" are encoded;
 * unicode handling uses UTF-8 as in ECMA-262.
 */
function encodeURIComponentStrict(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    });
}
function formatQueryParameter(name, value) {
    return "var-" + name + "=" + encodeURIComponentStrict(value);
}
export function isAllValue(value) {
    return value === ALL_VARIABLE_VALUE || (Array.isArray(value) && value[0] === ALL_VARIABLE_VALUE);
}
//# sourceMappingURL=formatRegistry.js.map