import { __assign, __makeTemplateObject } from "tslib";
import { InlineField, Input, QueryField } from '@grafana/ui';
import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { AddRemove } from '../../../../AddRemove';
import { useDispatch, useStatelessReducer } from '../../../../../hooks/useStatelessReducer';
import { changeBucketAggregationSetting } from '../../state/actions';
import { addFilter, changeFilter, removeFilter } from './state/actions';
import { reducer as filtersReducer } from './state/reducer';
export var FiltersSettingsEditor = function (_a) {
    var _b, _c, _d, _e;
    var bucketAgg = _a.bucketAgg;
    var upperStateDispatch = useDispatch();
    var dispatch = useStatelessReducer(function (newValue) { return upperStateDispatch(changeBucketAggregationSetting({ bucketAgg: bucketAgg, settingName: 'filters', newValue: newValue })); }, (_b = bucketAgg.settings) === null || _b === void 0 ? void 0 : _b.filters, filtersReducer);
    // The model might not have filters (or an empty array of filters) in it because of the way it was built in previous versions of the datasource.
    // If this is the case we add a default one.
    useEffect(function () {
        var _a, _b;
        if (!((_b = (_a = bucketAgg.settings) === null || _a === void 0 ? void 0 : _a.filters) === null || _b === void 0 ? void 0 : _b.length)) {
            dispatch(addFilter());
        }
    }, [dispatch, (_d = (_c = bucketAgg.settings) === null || _c === void 0 ? void 0 : _c.filters) === null || _d === void 0 ? void 0 : _d.length]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n          display: flex;\n          flex-direction: column;\n        "], ["\n          display: flex;\n          flex-direction: column;\n        "]))) }, (_e = bucketAgg.settings) === null || _e === void 0 ? void 0 : _e.filters.map(function (filter, index) {
            var _a;
            return (React.createElement("div", { key: index, className: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n              display: flex;\n            "], ["\n              display: flex;\n            "]))) },
                React.createElement("div", { className: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n                width: 250px;\n              "], ["\n                width: 250px;\n              "]))) },
                    React.createElement(InlineField, { label: "Query", labelWidth: 10 },
                        React.createElement(QueryField, { placeholder: "Lucene Query", portalOrigin: "elasticsearch", onBlur: function () { }, onChange: function (query) { return dispatch(changeFilter({ index: index, filter: __assign(__assign({}, filter), { query: query }) })); }, query: filter.query }))),
                React.createElement(InlineField, { label: "Label", labelWidth: 10 },
                    React.createElement(Input, { placeholder: "Label", onBlur: function (e) { return dispatch(changeFilter({ index: index, filter: __assign(__assign({}, filter), { label: e.target.value }) })); }, defaultValue: filter.label })),
                React.createElement(AddRemove, { index: index, elements: ((_a = bucketAgg.settings) === null || _a === void 0 ? void 0 : _a.filters) || [], onAdd: function () { return dispatch(addFilter()); }, onRemove: function () { return dispatch(removeFilter(index)); } })));
        }))));
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=index.js.map