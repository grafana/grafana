import React from 'react';
import { BucketAggregationEditor } from './BucketAggregationEditor';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { addBucketAggregation, removeBucketAggregation } from './state/actions';
import { useQuery } from '../ElasticsearchQueryContext';
import { QueryEditorRow } from '../QueryEditorRow';
import { IconButton } from '../../IconButton';
export var BucketAggregationsEditor = function (_a) {
    var nextId = _a.nextId;
    var dispatch = useDispatch();
    var bucketAggs = useQuery().bucketAggs;
    var totalBucketAggs = (bucketAggs === null || bucketAggs === void 0 ? void 0 : bucketAggs.length) || 0;
    return (React.createElement(React.Fragment, null, bucketAggs.map(function (bucketAgg, index) { return (React.createElement(QueryEditorRow, { key: bucketAgg.type + "-" + bucketAgg.id, label: index === 0 ? 'Group By' : 'Then By', onRemoveClick: totalBucketAggs > 1 && (function () { return dispatch(removeBucketAggregation(bucketAgg.id)); }) },
        React.createElement(BucketAggregationEditor, { value: bucketAgg }),
        index === 0 && (React.createElement(IconButton, { iconName: "plus", onClick: function () { return dispatch(addBucketAggregation(nextId)); }, label: "add" })))); })));
};
//# sourceMappingURL=index.js.map