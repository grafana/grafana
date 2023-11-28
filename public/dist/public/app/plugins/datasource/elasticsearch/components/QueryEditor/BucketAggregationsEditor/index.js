import React from 'react';
import { Button } from '@grafana/ui';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { useQuery } from '../ElasticsearchQueryContext';
import { QueryEditorRow } from '../QueryEditorRow';
import { BucketAggregationEditor } from './BucketAggregationEditor';
import { addBucketAggregation, removeBucketAggregation } from './state/actions';
export const BucketAggregationsEditor = ({ nextId }) => {
    const dispatch = useDispatch();
    const { bucketAggs } = useQuery();
    const totalBucketAggs = (bucketAggs === null || bucketAggs === void 0 ? void 0 : bucketAggs.length) || 0;
    return (React.createElement(React.Fragment, null, bucketAggs.map((bucketAgg, index) => (React.createElement(QueryEditorRow, { key: `${bucketAgg.type}-${bucketAgg.id}`, label: index === 0 ? 'Group By' : 'Then By', onRemoveClick: totalBucketAggs > 1 && (() => dispatch(removeBucketAggregation(bucketAgg.id))) },
        React.createElement(BucketAggregationEditor, { value: bucketAgg }),
        index === 0 && (React.createElement(Button, { variant: "secondary", fill: "text", icon: "plus", onClick: () => dispatch(addBucketAggregation(nextId)), tooltip: "Add grouping condition", "aria-label": "Add grouping condition" })))))));
};
//# sourceMappingURL=index.js.map