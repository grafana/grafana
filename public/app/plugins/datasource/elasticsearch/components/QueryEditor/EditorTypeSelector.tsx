import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';

import { MetricAggregation } from '../../dataquery.gen';
import { useDispatch } from '../../hooks/useStatelessReducer';
import { EditorType } from '../../types';

import { useQuery } from './ElasticsearchQueryContext';
import { changeMetricType } from './MetricAggregationsEditor/state/actions';
import { metricAggregationConfig } from './MetricAggregationsEditor/utils';

const BASE_OPTIONS: Array<SelectableValue<EditorType>> = [
  { value: 'builder', label: 'Builder' },
  { value: 'code', label: 'Code' },
];

function EditorTypeToMetricType(type: EditorType): MetricAggregation['type'] {
  switch (type) {
    case 'builder':
        case 'code':
            
    default:
      // should never happen
      throw new Error(`invalid query type: ${type}`);
  }
}

export const EditorTypeSelector = () => {
  const query = useQuery();
  const dispatch = useDispatch();

  const firstMetric = query.metrics?.[0];

  if (firstMetric == null) {
    // not sure if this can really happen, but we should handle it anyway
    return null;
  }

  const EditorType = metricAggregationConfig[firstMetric.type].impliedEditorType;

  const onChange = (newEditorType: EditorType) => {
    dispatch(changeMetricType({ id: firstMetric.id, type: EditorTypeToMetricType(newEditorType) }));
  };

  return <RadioButtonGroup<EditorType> fullWidth={false} options={BASE_OPTIONS} value={EditorType} onChange={onChange} />;
};
