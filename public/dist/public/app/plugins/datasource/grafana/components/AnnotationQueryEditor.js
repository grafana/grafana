import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { Field, FieldSet, Select, Switch, useStyles2 } from '@grafana/ui';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { getAnnotationTags } from 'app/features/annotations/api';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { GrafanaAnnotationType, GrafanaQueryType } from '../types';
import { TimeRegionEditor } from './TimeRegionEditor';
const matchTooltipContent = 'Enabling this returns annotations that match any of the tags specified below';
const tagsTooltipContent = (React.createElement("div", null, "Specify a list of tags to match. To specify a key and value tag use `key:value` syntax."));
const annotationTypes = [
    {
        label: 'Dashboard',
        value: GrafanaAnnotationType.Dashboard,
        description: 'Query for events created on this dashboard and show them in the panels where they where created',
    },
    {
        label: 'Tags',
        value: GrafanaAnnotationType.Tags,
        description: 'This will fetch any annotation events that match the tags filter',
    },
];
const queryTypes = [
    {
        label: 'Annotations & Alerts',
        value: GrafanaQueryType.Annotations,
        description: 'Show annotations or alerts managed by grafana',
    },
    {
        label: 'Time regions',
        value: GrafanaQueryType.TimeRegions,
        description: 'Configure a repeating time region',
    },
];
const limitOptions = [10, 50, 100, 200, 300, 500, 1000, 2000].map((limit) => ({
    label: String(limit),
    value: limit,
}));
export default function AnnotationQueryEditor({ query, onChange }) {
    const annotationQuery = query;
    const { limit, matchAny, tags, type, queryType } = annotationQuery;
    let grafanaQueryType = queryType !== null && queryType !== void 0 ? queryType : GrafanaQueryType.Annotations;
    const defaultTimezone = useMemo(() => { var _a; return (_a = getDashboardSrv().dashboard) === null || _a === void 0 ? void 0 : _a.getTimezone(); }, []);
    const styles = useStyles2(getStyles);
    const onFilterByChange = (newValue) => onChange(Object.assign(Object.assign({}, annotationQuery), { type: newValue.value }));
    const onMaxLimitChange = (newValue) => onChange(Object.assign(Object.assign({}, annotationQuery), { limit: newValue.value }));
    const onMatchAnyChange = (newValue) => onChange(Object.assign(Object.assign({}, annotationQuery), { matchAny: newValue.target.checked }));
    const onTagsChange = (tags) => onChange(Object.assign(Object.assign({}, annotationQuery), { tags }));
    const onQueryTypeChange = (newValue) => {
        const newQuery = Object.assign(Object.assign({}, annotationQuery), { queryType: newValue.value });
        if (newQuery.queryType === GrafanaQueryType.TimeRegions) {
            if (!newQuery.timeRegion) {
                newQuery.timeRegion = {
                    timezone: defaultTimezone,
                };
            }
        }
        else {
            delete newQuery.timeRegion;
        }
        onChange(newQuery);
    };
    const onTimeRegionChange = (timeRegion) => {
        onChange(Object.assign(Object.assign({}, annotationQuery), { timeRegion }));
    };
    return (React.createElement(FieldSet, { className: styles.container },
        React.createElement(Field, { label: "Query type" },
            React.createElement(Select, { inputId: "grafana-annotations__query-type", options: queryTypes, value: grafanaQueryType, onChange: onQueryTypeChange })),
        grafanaQueryType === GrafanaQueryType.Annotations && (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: "Filter by" },
                React.createElement(Select, { inputId: "grafana-annotations__filter-by", options: annotationTypes, value: type, onChange: onFilterByChange })),
            React.createElement(Field, { label: "Max limit" },
                React.createElement(Select, { inputId: "grafana-annotations__limit", width: 16, options: limitOptions, value: limit, onChange: onMaxLimitChange })),
            type === GrafanaAnnotationType.Tags && (React.createElement(React.Fragment, null,
                React.createElement(Field, { label: "Match any", description: matchTooltipContent },
                    React.createElement(Switch, { id: "grafana-annotations__match-any", value: matchAny, onChange: onMatchAnyChange })),
                React.createElement(Field, { label: "Tags", description: tagsTooltipContent },
                    React.createElement(TagFilter, { allowCustomValue: true, inputId: "grafana-annotations__tags", onChange: onTagsChange, tagOptions: getAnnotationTags, tags: tags !== null && tags !== void 0 ? tags : [] })))))),
        grafanaQueryType === GrafanaQueryType.TimeRegions && annotationQuery.timeRegion && (React.createElement(TimeRegionEditor, { value: annotationQuery.timeRegion, onChange: onTimeRegionChange }))));
}
const getStyles = (theme) => {
    return {
        container: css({
            maxWidth: theme.spacing(60),
            marginBottom: theme.spacing(2),
        }),
    };
};
//# sourceMappingURL=AnnotationQueryEditor.js.map