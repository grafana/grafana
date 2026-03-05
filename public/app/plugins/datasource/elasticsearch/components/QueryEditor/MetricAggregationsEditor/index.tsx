import { Alert, Button } from '@grafana/ui';

import { MetricAggregation } from '../../../dataquery.gen';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { useQuery } from '../ElasticsearchQueryContext';
import { QueryEditorRow } from '../QueryEditorRow';

import { MetricEditor } from './MetricEditor';
import { addMetric, removeMetric, toggleMetricVisibility } from './state/actions';
import { metricAggregationConfig } from './utils';

interface Props {
  nextId: MetricAggregation['id'];
}

export const MetricAggregationsEditor = ({ nextId }: Props) => {
  const dispatch = useDispatch();
  const { metrics } = useQuery();
  const totalMetrics = metrics?.length || 0;

  return (
    <>
      {metrics?.map((metric, index) => {
        switch (metric.type) {
           case 'logs':
            return;
           case 'raw_data':
            return;
          case 'raw_document':
            return <Alert severity="warning" title="The 'Raw Document' query type is deprecated." />;
          default:
            return (
              <QueryEditorRow
                key={`${metric.type}-${metric.id}`}
                label={`Metric (${metric.id})`}
                hidden={metric.hide}
                onHideClick={() => dispatch(toggleMetricVisibility(metric.id))}
                onRemoveClick={totalMetrics > 1 && (() => dispatch(removeMetric(metric.id)))}
              >
                <MetricEditor value={metric} />

                {metricAggregationConfig[metric.type].impliedQueryType === 'metrics' && index === 0 && (
                  <Button
                    variant="secondary"
                    fill="text"
                    icon="plus"
                    onClick={() => dispatch(addMetric(nextId))}
                    tooltip="Add metric"
                    aria-label="Add metric"
                  />
                )}
              </QueryEditorRow>
            );
        }
      })}
    </>
  );
};
