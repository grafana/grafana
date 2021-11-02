import { __assign, __makeTemplateObject, __read, __spreadArray } from "tslib";
import React, { useMemo } from 'react';
import { getTemplateSrv } from '@grafana/runtime';
import { FromSection } from './FromSection';
import { TagsSection } from './TagsSection';
import { PartListSection } from './PartListSection';
import { OrderByTimeSection } from './OrderByTimeSection';
import { InputSection } from './InputSection';
import { getAllMeasurementsForTags, getAllPolicies, getFieldKeysForMeasurement, getTagKeysForMeasurementAndTags, getTagValues, } from '../../influxQLMetadataQuery';
import { normalizeQuery, addNewSelectPart, removeSelectPart, addNewGroupByPart, removeGroupByPart, changeSelectPart, changeGroupByPart, } from '../../queryUtils';
import { FormatAsSection } from './FormatAsSection';
import { DEFAULT_RESULT_FORMAT } from '../constants';
import { getNewSelectPartOptions, getNewGroupByPartOptions, makePartList } from './partListUtils';
import { InlineLabel, SegmentSection, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
function getTemplateVariableOptions() {
    return (getTemplateSrv()
        .getVariables()
        // we make them regex-params, i'm not 100% sure why.
        // probably because this way multi-value variables work ok too.
        .map(function (v) { return "/^$" + v.name + "$/"; }));
}
// helper function to make it easy to call this from the widget-render-code
function withTemplateVariableOptions(optionsPromise) {
    return optionsPromise.then(function (options) { return __spreadArray(__spreadArray([], __read(getTemplateVariableOptions()), false), __read(options), false); });
}
export var Editor = function (props) {
    var _a, _b, _c, _d;
    var styles = useStyles2(getStyles);
    var query = normalizeQuery(props.query);
    var datasource = props.datasource;
    var measurement = query.measurement, policy = query.policy;
    var selectLists = useMemo(function () {
        var _a;
        var dynamicSelectPartOptions = new Map([
            [
                'field_0',
                function () {
                    return measurement !== undefined
                        ? getFieldKeysForMeasurement(measurement, policy, datasource)
                        : Promise.resolve([]);
                },
            ],
        ]);
        return ((_a = query.select) !== null && _a !== void 0 ? _a : []).map(function (sel) { return makePartList(sel, dynamicSelectPartOptions); });
    }, [measurement, policy, query.select, datasource]);
    // the following function is not complicated enough to memoize, but it's result
    // is used in both memoized and un-memoized parts, so we have no choice
    var getTagKeys = useMemo(function () {
        return function () { var _a; return getTagKeysForMeasurementAndTags(measurement, policy, (_a = query.tags) !== null && _a !== void 0 ? _a : [], datasource); };
    }, [measurement, policy, query.tags, datasource]);
    var groupByList = useMemo(function () {
        var _a;
        var dynamicGroupByPartOptions = new Map([['tag_0', getTagKeys]]);
        return makePartList((_a = query.groupBy) !== null && _a !== void 0 ? _a : [], dynamicGroupByPartOptions);
    }, [getTagKeys, query.groupBy]);
    var onAppliedChange = function (newQuery) {
        props.onChange(newQuery);
        props.onRunQuery();
    };
    var handleFromSectionChange = function (p, m) {
        onAppliedChange(__assign(__assign({}, query), { policy: p, measurement: m }));
    };
    var handleTagsSectionChange = function (tags) {
        // we set empty-arrays to undefined
        onAppliedChange(__assign(__assign({}, query), { tags: tags.length === 0 ? undefined : tags }));
    };
    return (React.createElement("div", null,
        React.createElement(SegmentSection, { label: "FROM", fill: true },
            React.createElement(FromSection, { policy: policy, measurement: measurement, getPolicyOptions: function () { return getAllPolicies(datasource); }, getMeasurementOptions: function (filter) {
                    var _a;
                    return withTemplateVariableOptions(getAllMeasurementsForTags(filter === '' ? undefined : filter, (_a = query.tags) !== null && _a !== void 0 ? _a : [], datasource));
                }, onChange: handleFromSectionChange }),
            React.createElement(InlineLabel, { width: "auto", className: styles.inlineLabel }, "WHERE"),
            React.createElement(TagsSection, { tags: (_a = query.tags) !== null && _a !== void 0 ? _a : [], onChange: handleTagsSectionChange, getTagKeyOptions: getTagKeys, getTagValueOptions: function (key) { var _a; return withTemplateVariableOptions(getTagValues(key, measurement, policy, (_a = query.tags) !== null && _a !== void 0 ? _a : [], datasource)); } })),
        selectLists.map(function (sel, index) { return (React.createElement(SegmentSection, { key: index, label: index === 0 ? 'SELECT' : '', fill: true },
            React.createElement(PartListSection, { parts: sel, getNewPartOptions: function () { return Promise.resolve(getNewSelectPartOptions()); }, onChange: function (partIndex, newParams) {
                    var newQuery = changeSelectPart(query, index, partIndex, newParams);
                    onAppliedChange(newQuery);
                }, onAddNewPart: function (type) {
                    onAppliedChange(addNewSelectPart(query, type, index));
                }, onRemovePart: function (partIndex) {
                    onAppliedChange(removeSelectPart(query, partIndex, index));
                } }))); }),
        React.createElement(SegmentSection, { label: "GROUP BY", fill: true },
            React.createElement(PartListSection, { parts: groupByList, getNewPartOptions: function () { return getNewGroupByPartOptions(query, getTagKeys); }, onChange: function (partIndex, newParams) {
                    var newQuery = changeGroupByPart(query, partIndex, newParams);
                    onAppliedChange(newQuery);
                }, onAddNewPart: function (type) {
                    onAppliedChange(addNewGroupByPart(query, type));
                }, onRemovePart: function (partIndex) {
                    onAppliedChange(removeGroupByPart(query, partIndex));
                } })),
        React.createElement(SegmentSection, { label: "TIMEZONE", fill: true },
            React.createElement(InputSection, { placeholder: "(optional)", value: query.tz, onChange: function (tz) {
                    onAppliedChange(__assign(__assign({}, query), { tz: tz }));
                } }),
            React.createElement(InlineLabel, { width: "auto", className: styles.inlineLabel }, "ORDER BY TIME"),
            React.createElement(OrderByTimeSection, { value: query.orderByTime === 'DESC' ? 'DESC' : 'ASC' /* FIXME: make this shared with influx_query_model */, onChange: function (v) {
                    onAppliedChange(__assign(__assign({}, query), { orderByTime: v }));
                } })),
        React.createElement(SegmentSection, { label: "LIMIT", fill: true },
            React.createElement(InputSection, { placeholder: "(optional)", value: (_b = query.limit) === null || _b === void 0 ? void 0 : _b.toString(), onChange: function (limit) {
                    onAppliedChange(__assign(__assign({}, query), { limit: limit }));
                } }),
            React.createElement(InlineLabel, { width: "auto", className: styles.inlineLabel }, "SLIMIT"),
            React.createElement(InputSection, { placeholder: "(optional)", value: (_c = query.slimit) === null || _c === void 0 ? void 0 : _c.toString(), onChange: function (slimit) {
                    onAppliedChange(__assign(__assign({}, query), { slimit: slimit }));
                } })),
        React.createElement(SegmentSection, { label: "FORMAT AS", fill: true },
            React.createElement(FormatAsSection, { format: (_d = query.resultFormat) !== null && _d !== void 0 ? _d : DEFAULT_RESULT_FORMAT, onChange: function (format) {
                    onAppliedChange(__assign(__assign({}, query), { resultFormat: format }));
                } }),
            query.resultFormat !== 'table' && (React.createElement(React.Fragment, null,
                React.createElement(InlineLabel, { width: "auto", className: styles.inlineLabel }, "ALIAS"),
                React.createElement(InputSection, { isWide: true, placeholder: "Naming pattern", value: query.alias, onChange: function (alias) {
                        onAppliedChange(__assign(__assign({}, query), { alias: alias }));
                    } }))))));
};
function getStyles(theme) {
    return {
        inlineLabel: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      color: ", ";\n    "], ["\n      color: ", ";\n    "])), theme.colors.primary.text),
    };
}
var templateObject_1;
//# sourceMappingURL=Editor.js.map