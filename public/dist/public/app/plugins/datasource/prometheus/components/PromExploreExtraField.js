import { __assign, __makeTemplateObject } from "tslib";
import React, { memo, useCallback } from 'react';
import { usePrevious } from 'react-use';
import { isEqual } from 'lodash';
import { css, cx } from '@emotion/css';
import { InlineFormLabel, RadioButtonGroup } from '@grafana/ui';
import { PromExemplarField } from './PromExemplarField';
export var PromExploreExtraField = memo(function (_a) {
    var _b;
    var query = _a.query, datasource = _a.datasource, onChange = _a.onChange, onRunQuery = _a.onRunQuery;
    var rangeOptions = [
        { value: 'range', label: 'Range', description: 'Run query over a range of time.' },
        {
            value: 'instant',
            label: 'Instant',
            description: 'Run query against a single point in time. For this query, the "To" time is used.',
        },
        { value: 'both', label: 'Both', description: 'Run an Instant query and a Range query.' },
    ];
    var prevQuery = usePrevious(query);
    var onExemplarChange = useCallback(function (exemplar) {
        if (!isEqual(query, prevQuery) || exemplar !== query.exemplar) {
            onChange(__assign(__assign({}, query), { exemplar: exemplar }));
        }
    }, [prevQuery, query, onChange]);
    function onChangeQueryStep(interval) {
        onChange(__assign(__assign({}, query), { interval: interval }));
    }
    function onStepChange(e) {
        if (e.currentTarget.value !== query.interval) {
            onChangeQueryStep(e.currentTarget.value);
        }
    }
    function onReturnKeyDown(e) {
        if (e.key === 'Enter' && e.shiftKey) {
            onRunQuery();
        }
    }
    function onQueryTypeChange(queryType) {
        var nextQuery;
        if (queryType === 'instant') {
            nextQuery = __assign(__assign({}, query), { instant: true, range: false });
        }
        else if (queryType === 'range') {
            nextQuery = __assign(__assign({}, query), { instant: false, range: true });
        }
        else {
            nextQuery = __assign(__assign({}, query), { instant: true, range: true });
        }
        onChange(nextQuery);
    }
    return (React.createElement("div", { "aria-label": "Prometheus extra field", className: "gf-form-inline" },
        React.createElement("div", { "data-testid": "queryTypeField", className: cx('gf-form explore-input-margin', css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n              flex-wrap: nowrap;\n            "], ["\n              flex-wrap: nowrap;\n            "])))), "aria-label": "Query type field" },
            React.createElement(InlineFormLabel, { width: "auto" }, "Query type"),
            React.createElement(RadioButtonGroup, { options: rangeOptions, value: query.range === query.instant ? 'both' : query.instant ? 'instant' : 'range', onChange: onQueryTypeChange })),
        React.createElement("div", { "data-testid": "stepField", className: cx('gf-form', css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n              flex-wrap: nowrap;\n            "], ["\n              flex-wrap: nowrap;\n            "])))), "aria-label": "Step field" },
            React.createElement(InlineFormLabel, { width: 5, tooltip: 'Time units can be used here, for example: 5s, 1m, 3h, 1d, 1y (Default if no unit is specified: s)' }, "Step"),
            React.createElement("input", { type: 'text', className: "gf-form-input width-4", placeholder: 'auto', onChange: onStepChange, onKeyDown: onReturnKeyDown, value: (_b = query.interval) !== null && _b !== void 0 ? _b : '' })),
        React.createElement(PromExemplarField, { onChange: onExemplarChange, datasource: datasource, query: query })));
});
var templateObject_1, templateObject_2;
//# sourceMappingURL=PromExploreExtraField.js.map