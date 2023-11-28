import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { useEffect, useRef } from 'react';
import { InlineField, Input, QueryField } from '@grafana/ui';
import { useDispatch, useStatelessReducer } from '../../../../../hooks/useStatelessReducer';
import { AddRemove } from '../../../../AddRemove';
import { changeBucketAggregationSetting } from '../../state/actions';
import { addFilter, changeFilter, removeFilter } from './state/actions';
import { reducer as filtersReducer } from './state/reducer';
export const FiltersSettingsEditor = ({ bucketAgg }) => {
    var _a, _b, _c, _d;
    const { current: baseId } = useRef(uniqueId('es-filters-'));
    const upperStateDispatch = useDispatch();
    const dispatch = useStatelessReducer((newValue) => upperStateDispatch(changeBucketAggregationSetting({ bucketAgg, settingName: 'filters', newValue })), (_a = bucketAgg.settings) === null || _a === void 0 ? void 0 : _a.filters, filtersReducer);
    // The model might not have filters (or an empty array of filters) in it because of the way it was built in previous versions of the datasource.
    // If this is the case we add a default one.
    useEffect(() => {
        var _a, _b;
        if (!((_b = (_a = bucketAgg.settings) === null || _a === void 0 ? void 0 : _a.filters) === null || _b === void 0 ? void 0 : _b.length)) {
            dispatch(addFilter());
        }
    }, [dispatch, (_c = (_b = bucketAgg.settings) === null || _b === void 0 ? void 0 : _b.filters) === null || _c === void 0 ? void 0 : _c.length]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: css `
          display: flex;
          flex-direction: column;
        ` }, (_d = bucketAgg.settings) === null || _d === void 0 ? void 0 : _d.filters.map((filter, index) => {
            var _a;
            return (React.createElement("div", { key: index, className: css `
              display: flex;
            ` },
                React.createElement(InlineField, { label: "Query", labelWidth: 8 },
                    React.createElement("div", { className: css `
                  width: 150px;
                ` },
                        React.createElement(QueryField, { placeholder: "Lucene Query", portalOrigin: "elasticsearch", onChange: (query) => dispatch(changeFilter({ index, filter: Object.assign(Object.assign({}, filter), { query }) })), query: filter.query }))),
                React.createElement(InlineField, { label: "Label", labelWidth: 8 },
                    React.createElement(Input, { width: 16, id: `${baseId}-label-${index}`, placeholder: "Label", onBlur: (e) => dispatch(changeFilter({ index, filter: Object.assign(Object.assign({}, filter), { label: e.target.value }) })), defaultValue: filter.label })),
                React.createElement(AddRemove, { index: index, elements: ((_a = bucketAgg.settings) === null || _a === void 0 ? void 0 : _a.filters) || [], onAdd: () => dispatch(addFilter()), onRemove: () => dispatch(removeFilter(index)) })));
        }))));
};
//# sourceMappingURL=index.js.map