import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useId, useMemo } from 'react';
import { InlineLabel, SegmentSection, useStyles2 } from '@grafana/ui';
import { getAllMeasurements, getAllPolicies, getFieldKeys, getTagKeys, getTagValues, } from '../../../../../influxql_metadata_query';
import { addNewGroupByPart, addNewSelectPart, changeGroupByPart, changeSelectPart, normalizeQuery, removeGroupByPart, removeSelectPart, } from '../../../../../queryUtils';
import { DEFAULT_RESULT_FORMAT } from '../../../constants';
import { filterTags } from '../utils/filterTags';
import { getNewGroupByPartOptions, getNewSelectPartOptions, makePartList } from '../utils/partListUtils';
import { withTemplateVariableOptions } from '../utils/withTemplateVariableOptions';
import { wrapPure, wrapRegex } from '../utils/wrapper';
import { FormatAsSection } from './FormatAsSection';
import { FromSection } from './FromSection';
import { InputSection } from './InputSection';
import { OrderByTimeSection } from './OrderByTimeSection';
import { PartListSection } from './PartListSection';
import { TagsSection } from './TagsSection';
export const VisualInfluxQLEditor = (props) => {
    var _a, _b, _c, _d;
    const uniqueId = useId();
    const formatAsId = `influxdb-qe-format-as-${uniqueId}`;
    const orderByTimeId = `influxdb-qe-order-by${uniqueId}`;
    const styles = useStyles2(getStyles);
    const query = normalizeQuery(props.query);
    const { datasource } = props;
    const { measurement, policy } = query;
    const allTagKeys = useMemo(() => __awaiter(void 0, void 0, void 0, function* () {
        const tagKeys = (yield getTagKeys(datasource, measurement, policy)).map((tag) => `${tag}::tag`);
        const fieldKeys = (yield getFieldKeys(datasource, measurement || '', policy)).map((field) => `${field}::field`);
        return new Set([...tagKeys, ...fieldKeys]);
    }), [measurement, policy, datasource]);
    const selectLists = useMemo(() => {
        var _a;
        const dynamicSelectPartOptions = new Map([
            [
                'field_0',
                () => {
                    return measurement !== undefined ? getFieldKeys(datasource, measurement, policy) : Promise.resolve([]);
                },
            ],
        ]);
        return ((_a = query.select) !== null && _a !== void 0 ? _a : []).map((sel) => makePartList(sel, dynamicSelectPartOptions));
    }, [measurement, policy, query.select, datasource]);
    // the following function is not complicated enough to memoize, but it's result
    // is used in both memoized and un-memoized parts, so we have no choice
    const getMemoizedTagKeys = useMemo(() => () => __awaiter(void 0, void 0, void 0, function* () {
        return [...(yield allTagKeys)];
    }), [allTagKeys]);
    const groupByList = useMemo(() => {
        var _a;
        const dynamicGroupByPartOptions = new Map([['tag_0', getMemoizedTagKeys]]);
        return makePartList((_a = query.groupBy) !== null && _a !== void 0 ? _a : [], dynamicGroupByPartOptions);
    }, [getMemoizedTagKeys, query.groupBy]);
    const onAppliedChange = (newQuery) => {
        props.onChange(newQuery);
        props.onRunQuery();
    };
    const handleFromSectionChange = (p, m) => {
        onAppliedChange(Object.assign(Object.assign({}, query), { policy: p, measurement: m }));
    };
    const handleTagsSectionChange = (tags) => {
        // we set empty-arrays to undefined
        onAppliedChange(Object.assign(Object.assign({}, query), { tags: tags.length === 0 ? undefined : tags }));
    };
    return (React.createElement("div", null,
        React.createElement(SegmentSection, { label: "FROM", fill: true },
            React.createElement(FromSection, { policy: policy, measurement: measurement, getPolicyOptions: () => withTemplateVariableOptions(getAllPolicies(datasource), wrapPure), getMeasurementOptions: (filter) => withTemplateVariableOptions(allTagKeys.then((keys) => { var _a; return getAllMeasurements(datasource, filterTags((_a = query.tags) !== null && _a !== void 0 ? _a : [], keys), filter === '' ? undefined : filter); }), wrapRegex, filter), onChange: handleFromSectionChange }),
            React.createElement(InlineLabel, { width: "auto", className: styles.inlineLabel }, "WHERE"),
            React.createElement(TagsSection, { tags: (_a = query.tags) !== null && _a !== void 0 ? _a : [], onChange: handleTagsSectionChange, getTagKeyOptions: getMemoizedTagKeys, getTagValueOptions: (key) => withTemplateVariableOptions(allTagKeys.then((keys) => { var _a; return getTagValues(datasource, filterTags((_a = query.tags) !== null && _a !== void 0 ? _a : [], keys), key); }), wrapRegex) })),
        selectLists.map((sel, index) => (React.createElement(SegmentSection, { key: index, label: index === 0 ? 'SELECT' : '', fill: true },
            React.createElement(PartListSection, { parts: sel, getNewPartOptions: () => Promise.resolve(getNewSelectPartOptions()), onChange: (partIndex, newParams) => {
                    const newQuery = changeSelectPart(query, index, partIndex, newParams);
                    onAppliedChange(newQuery);
                }, onAddNewPart: (type) => {
                    onAppliedChange(addNewSelectPart(query, type, index));
                }, onRemovePart: (partIndex) => {
                    onAppliedChange(removeSelectPart(query, partIndex, index));
                } })))),
        React.createElement(SegmentSection, { label: "GROUP BY", fill: true },
            React.createElement(PartListSection, { parts: groupByList, getNewPartOptions: () => getNewGroupByPartOptions(query, getMemoizedTagKeys), onChange: (partIndex, newParams) => {
                    const newQuery = changeGroupByPart(query, partIndex, newParams);
                    onAppliedChange(newQuery);
                }, onAddNewPart: (type) => {
                    onAppliedChange(addNewGroupByPart(query, type));
                }, onRemovePart: (partIndex) => {
                    onAppliedChange(removeGroupByPart(query, partIndex));
                } })),
        React.createElement(SegmentSection, { label: "TIMEZONE", fill: true },
            React.createElement(InputSection, { placeholder: "(optional)", value: query.tz, onChange: (tz) => {
                    onAppliedChange(Object.assign(Object.assign({}, query), { tz }));
                } }),
            React.createElement(InlineLabel, { htmlFor: orderByTimeId, width: "auto", className: styles.inlineLabel }, "ORDER BY TIME"),
            React.createElement(OrderByTimeSection, { inputId: orderByTimeId, value: query.orderByTime === 'DESC' ? 'DESC' : 'ASC' /* FIXME: make this shared with influx_query_model */, onChange: (v) => {
                    onAppliedChange(Object.assign(Object.assign({}, query), { orderByTime: v }));
                } })),
        React.createElement(SegmentSection, { label: "LIMIT", fill: true },
            React.createElement(InputSection, { placeholder: "(optional)", value: (_b = query.limit) === null || _b === void 0 ? void 0 : _b.toString(), onChange: (limit) => {
                    onAppliedChange(Object.assign(Object.assign({}, query), { limit }));
                } }),
            React.createElement(InlineLabel, { width: "auto", className: styles.inlineLabel }, "SLIMIT"),
            React.createElement(InputSection, { placeholder: "(optional)", value: (_c = query.slimit) === null || _c === void 0 ? void 0 : _c.toString(), onChange: (slimit) => {
                    onAppliedChange(Object.assign(Object.assign({}, query), { slimit }));
                } })),
        React.createElement(SegmentSection, { htmlFor: formatAsId, label: "FORMAT AS", fill: true },
            React.createElement(FormatAsSection, { inputId: formatAsId, format: (_d = query.resultFormat) !== null && _d !== void 0 ? _d : DEFAULT_RESULT_FORMAT, onChange: (format) => {
                    onAppliedChange(Object.assign(Object.assign({}, query), { resultFormat: format }));
                } }),
            query.resultFormat !== 'table' && (React.createElement(React.Fragment, null,
                React.createElement(InlineLabel, { width: "auto", className: styles.inlineLabel }, "ALIAS"),
                React.createElement(InputSection, { isWide: true, placeholder: "Naming pattern", value: query.alias, onChange: (alias) => {
                        onAppliedChange(Object.assign(Object.assign({}, query), { alias }));
                    } }))))));
};
function getStyles(theme) {
    return {
        inlineLabel: css `
      color: ${theme.colors.primary.text};
    `,
    };
}
//# sourceMappingURL=VisualInfluxQLEditor.js.map