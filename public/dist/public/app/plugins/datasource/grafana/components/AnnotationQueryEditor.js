import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { Field, FieldSet, Select, Switch } from '@grafana/ui';
import { css } from '@emotion/css';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { GrafanaAnnotationType } from '../types';
import { getAnnotationTags } from 'app/features/annotations/api';
var matchTooltipContent = 'Enabling this returns annotations that match any of the tags specified below';
var tagsTooltipContent = (React.createElement("div", null, "Specify a list of tags to match. To specify a key and value tag use `key:value` syntax."));
var annotationTypes = [
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
var limitOptions = [10, 50, 100, 200, 300, 500, 1000, 2000].map(function (limit) { return ({
    label: String(limit),
    value: limit,
}); });
export default function AnnotationQueryEditor(_a) {
    var query = _a.query, onChange = _a.onChange;
    var annotationQuery = query;
    var limit = annotationQuery.limit, matchAny = annotationQuery.matchAny, tags = annotationQuery.tags, type = annotationQuery.type;
    var styles = getStyles();
    var onFilterByChange = function (newValue) {
        return onChange(__assign(__assign({}, annotationQuery), { type: newValue.value }));
    };
    var onMaxLimitChange = function (newValue) {
        return onChange(__assign(__assign({}, annotationQuery), { limit: newValue.value }));
    };
    var onMatchAnyChange = function (newValue) {
        return onChange(__assign(__assign({}, annotationQuery), { matchAny: newValue.target.checked }));
    };
    var onTagsChange = function (tags) {
        return onChange(__assign(__assign({}, annotationQuery), { tags: tags }));
    };
    var onFormatCreateLabel = function (input) { return "Use custom value: " + input; };
    return (React.createElement(FieldSet, { className: styles.container },
        React.createElement(Field, { label: "Filter by" },
            React.createElement(Select, { menuShouldPortal: true, inputId: "grafana-annotations__filter-by", options: annotationTypes, value: type, onChange: onFilterByChange })),
        React.createElement(Field, { label: "Max limit" },
            React.createElement(Select, { menuShouldPortal: true, inputId: "grafana-annotations__limit", width: 16, options: limitOptions, value: limit, onChange: onMaxLimitChange })),
        type === GrafanaAnnotationType.Tags && tags && (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: "Match any", description: matchTooltipContent },
                React.createElement(Switch, { id: "grafana-annotations__match-any", value: matchAny, onChange: onMatchAnyChange })),
            React.createElement(Field, { label: "Tags", description: tagsTooltipContent },
                React.createElement(TagFilter, { allowCustomValue: true, formatCreateLabel: onFormatCreateLabel, inputId: "grafana-annotations__tags", onChange: onTagsChange, tagOptions: getAnnotationTags, tags: tags }))))));
}
var getStyles = function () {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      max-width: 600px;\n    "], ["\n      max-width: 600px;\n    "]))),
    };
};
var templateObject_1;
//# sourceMappingURL=AnnotationQueryEditor.js.map