import { __assign, __read, __spreadArray, __values } from "tslib";
import { chain } from 'lodash';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getTemplateSrv } from '@grafana/runtime';
import coreModule from 'app/core/core_module';
import { getConfig } from 'app/core/config';
import { DataLinkBuiltInVars, deprecationWarning, FieldType, getFieldDisplayName, locationUtil, textUtil, urlUtil, VariableOrigin, VariableSuggestionsScope, } from '@grafana/data';
import { getVariablesUrlParams } from '../../../features/variables/getAllVariableValuesForUrl';
var timeRangeVars = [
    {
        value: "" + DataLinkBuiltInVars.keepTime,
        label: 'Time range',
        documentation: 'Adds current time range',
        origin: VariableOrigin.BuiltIn,
    },
    {
        value: "" + DataLinkBuiltInVars.timeRangeFrom,
        label: 'Time range: from',
        documentation: "Adds current time range's from value",
        origin: VariableOrigin.BuiltIn,
    },
    {
        value: "" + DataLinkBuiltInVars.timeRangeTo,
        label: 'Time range: to',
        documentation: "Adds current time range's to value",
        origin: VariableOrigin.BuiltIn,
    },
];
var seriesVars = [
    {
        value: "" + DataLinkBuiltInVars.seriesName,
        label: 'Name',
        documentation: 'Name of the series',
        origin: VariableOrigin.Series,
    },
];
var valueVars = [
    {
        value: "" + DataLinkBuiltInVars.valueNumeric,
        label: 'Numeric',
        documentation: 'Numeric representation of selected value',
        origin: VariableOrigin.Value,
    },
    {
        value: "" + DataLinkBuiltInVars.valueText,
        label: 'Text',
        documentation: 'Text representation of selected value',
        origin: VariableOrigin.Value,
    },
    {
        value: "" + DataLinkBuiltInVars.valueRaw,
        label: 'Raw',
        documentation: 'Raw value',
        origin: VariableOrigin.Value,
    },
];
var buildLabelPath = function (label) {
    return label.includes('.') || label.trim().includes(' ') ? "[\"" + label + "\"]" : "." + label;
};
export var getPanelLinksVariableSuggestions = function () { return __spreadArray(__spreadArray(__spreadArray([], __read(getTemplateSrv()
    .getVariables()
    .map(function (variable) { return ({
    value: variable.name,
    label: variable.name,
    origin: VariableOrigin.Template,
}); })), false), [
    {
        value: "" + DataLinkBuiltInVars.includeVars,
        label: 'All variables',
        documentation: 'Adds current variables',
        origin: VariableOrigin.Template,
    }
], false), __read(timeRangeVars), false); };
var getFieldVars = function (dataFrames) {
    var e_1, _a, e_2, _b, e_3, _c;
    var all = [];
    try {
        for (var dataFrames_1 = __values(dataFrames), dataFrames_1_1 = dataFrames_1.next(); !dataFrames_1_1.done; dataFrames_1_1 = dataFrames_1.next()) {
            var df = dataFrames_1_1.value;
            try {
                for (var _d = (e_2 = void 0, __values(df.fields)), _e = _d.next(); !_e.done; _e = _d.next()) {
                    var f = _e.value;
                    if (f.labels) {
                        try {
                            for (var _f = (e_3 = void 0, __values(Object.keys(f.labels))), _g = _f.next(); !_g.done; _g = _f.next()) {
                                var k = _g.value;
                                all.push(k);
                            }
                        }
                        catch (e_3_1) { e_3 = { error: e_3_1 }; }
                        finally {
                            try {
                                if (_g && !_g.done && (_c = _f.return)) _c.call(_f);
                            }
                            finally { if (e_3) throw e_3.error; }
                        }
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (dataFrames_1_1 && !dataFrames_1_1.done && (_a = dataFrames_1.return)) _a.call(dataFrames_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    var labels = chain(all).flatten().uniq().value();
    return __spreadArray([
        {
            value: "" + DataLinkBuiltInVars.fieldName,
            label: 'Name',
            documentation: 'Field name of the clicked datapoint (in ms epoch)',
            origin: VariableOrigin.Field,
        }
    ], __read(labels.map(function (label) { return ({
        value: "__field.labels" + buildLabelPath(label),
        label: "labels." + label,
        documentation: label + " label value",
        origin: VariableOrigin.Field,
    }); })), false);
};
export var getDataFrameVars = function (dataFrames) {
    var e_4, _a;
    var numeric = undefined;
    var title = undefined;
    var suggestions = [];
    var keys = {};
    if (dataFrames.length !== 1) {
        // It's not possible to access fields of other dataframes. So if there are multiple dataframes we need to skip these suggestions.
        // Also return early if there are no dataFrames.
        return [];
    }
    var frame = dataFrames[0];
    try {
        for (var _b = __values(frame.fields), _c = _b.next(); !_c.done; _c = _b.next()) {
            var field = _c.value;
            var displayName = getFieldDisplayName(field, frame, dataFrames);
            if (keys[displayName]) {
                continue;
            }
            suggestions.push({
                value: "__data.fields" + buildLabelPath(displayName),
                label: "" + displayName,
                documentation: "Formatted value for " + displayName + " on the same row",
                origin: VariableOrigin.Fields,
            });
            keys[displayName] = true;
            if (!numeric && field.type === FieldType.number) {
                numeric = __assign(__assign({}, field), { name: displayName });
            }
            if (!title && field.config.displayName && field.config.displayName !== field.name) {
                title = __assign(__assign({}, field), { name: displayName });
            }
        }
    }
    catch (e_4_1) { e_4 = { error: e_4_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_4) throw e_4.error; }
    }
    if (suggestions.length) {
        suggestions.push({
            value: "__data.fields[0]",
            label: "Select by index",
            documentation: "Enter the field order",
            origin: VariableOrigin.Fields,
        });
    }
    if (numeric) {
        suggestions.push({
            value: "__data.fields" + buildLabelPath(numeric.name) + ".numeric",
            label: "Show numeric value",
            documentation: "the numeric field value",
            origin: VariableOrigin.Fields,
        });
        suggestions.push({
            value: "__data.fields" + buildLabelPath(numeric.name) + ".text",
            label: "Show text value",
            documentation: "the text value",
            origin: VariableOrigin.Fields,
        });
    }
    if (title) {
        suggestions.push({
            value: "__data.fields" + buildLabelPath(title.name),
            label: "Select by title",
            documentation: "Use the title to pick the field",
            origin: VariableOrigin.Fields,
        });
    }
    return suggestions;
};
export var getDataLinksVariableSuggestions = function (dataFrames, scope) {
    var valueTimeVar = {
        value: "" + DataLinkBuiltInVars.valueTime,
        label: 'Time',
        documentation: 'Time value of the clicked datapoint (in ms epoch)',
        origin: VariableOrigin.Value,
    };
    var includeValueVars = scope === VariableSuggestionsScope.Values;
    return includeValueVars
        ? __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], __read(seriesVars), false), __read(getFieldVars(dataFrames)), false), __read(valueVars), false), [
            valueTimeVar
        ], false), __read(getDataFrameVars(dataFrames)), false), __read(getPanelLinksVariableSuggestions()), false) : __spreadArray(__spreadArray(__spreadArray(__spreadArray([], __read(seriesVars), false), __read(getFieldVars(dataFrames)), false), __read(getDataFrameVars(dataFrames)), false), __read(getPanelLinksVariableSuggestions()), false);
};
export var getCalculationValueDataLinksVariableSuggestions = function (dataFrames) {
    var fieldVars = getFieldVars(dataFrames);
    var valueCalcVar = {
        value: "" + DataLinkBuiltInVars.valueCalc,
        label: 'Calculation name',
        documentation: 'Name of the calculation the value is a result of',
        origin: VariableOrigin.Value,
    };
    return __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], __read(seriesVars), false), __read(fieldVars), false), __read(valueVars), false), [valueCalcVar], false), __read(getPanelLinksVariableSuggestions()), false);
};
export var getPanelOptionsVariableSuggestions = function (plugin, data) {
    var dataVariables = plugin.meta.skipDataQuery ? [] : getDataFrameVars(data || []);
    return __spreadArray(__spreadArray([], __read(dataVariables), false), __read(getTemplateSrv()
        .getVariables()
        .map(function (variable) { return ({
        value: variable.name,
        label: variable.name,
        origin: VariableOrigin.Template,
    }); })), false);
};
var LinkSrv = /** @class */ (function () {
    function LinkSrv() {
        /**
         * Returns LinkModel which is basically a DataLink with all values interpolated through the templateSrv.
         */
        this.getDataLinkUIModel = function (link, replaceVariables, origin) {
            var _a;
            var href = link.url;
            if (link.onBuildUrl) {
                href = link.onBuildUrl({
                    origin: origin,
                    replaceVariables: replaceVariables,
                });
            }
            var info = {
                href: locationUtil.assureBaseUrl(href.replace(/\n/g, '')),
                title: (_a = link.title) !== null && _a !== void 0 ? _a : '',
                target: link.targetBlank ? '_blank' : undefined,
                origin: origin,
            };
            if (replaceVariables) {
                info.href = replaceVariables(info.href);
                info.title = replaceVariables(link.title);
            }
            if (link.onClick) {
                info.onClick = function (e) {
                    link.onClick({
                        origin: origin,
                        replaceVariables: replaceVariables,
                        e: e,
                    });
                };
            }
            info.href = getConfig().disableSanitizeHtml ? info.href : textUtil.sanitizeUrl(info.href);
            return info;
        };
    }
    LinkSrv.prototype.getLinkUrl = function (link) {
        var url = locationUtil.assureBaseUrl(getTemplateSrv().replace(link.url || ''));
        var params = {};
        if (link.keepTime) {
            var range = getTimeSrv().timeRangeForUrl();
            params['from'] = range.from;
            params['to'] = range.to;
        }
        if (link.includeVars) {
            params = __assign(__assign({}, params), getVariablesUrlParams());
        }
        url = urlUtil.appendQueryToUrl(url, urlUtil.toUrlParams(params));
        return getConfig().disableSanitizeHtml ? url : textUtil.sanitizeUrl(url);
    };
    LinkSrv.prototype.getAnchorInfo = function (link) {
        var templateSrv = getTemplateSrv();
        var info = {};
        info.href = this.getLinkUrl(link);
        info.title = templateSrv.replace(link.title || '');
        info.tooltip = templateSrv.replace(link.tooltip || '');
        return info;
    };
    /**
     * getPanelLinkAnchorInfo method is left for plugins compatibility reasons
     *
     * @deprecated Drilldown links should be generated using getDataLinkUIModel method
     */
    LinkSrv.prototype.getPanelLinkAnchorInfo = function (link, scopedVars) {
        deprecationWarning('link_srv.ts', 'getPanelLinkAnchorInfo', 'getDataLinkUIModel');
        var replace = function (value, vars, fmt) {
            return getTemplateSrv().replace(value, __assign(__assign({}, scopedVars), vars), fmt);
        };
        return this.getDataLinkUIModel(link, replace, {});
    };
    return LinkSrv;
}());
export { LinkSrv };
var singleton;
export function setLinkSrv(srv) {
    singleton = srv;
}
export function getLinkSrv() {
    return singleton;
}
coreModule.service('linkSrv', LinkSrv);
//# sourceMappingURL=link_srv.js.map