import { SelectableValue } from '@grafana/data';
import { InlineField, Segment, SegmentAsync, useTheme } from '@grafana/ui';
import { cx } from 'emotion';
import React, { FunctionComponent } from 'react';
import { useDatasource, useDispatch } from '../ElasticsearchQueryContext';
import { getStyles } from './styles';
import { marginZero } from '../styles';
import { MetricAggregation, MetricAggregationAction, MetricAggregationType } from '../../state/metricAggregation/types';
import { metricAggregationConfig } from '../../state/metricAggregation/utils';
import { changeMetricType, toggleMetricVisibility } from '../../state/metricAggregation/actions';
import { ToggleVisibilityButton } from '../ToggleVisibilityButton';

const metricAggOptions: Array<SelectableValue<MetricAggregationType>> = Object.entries(metricAggregationConfig).map(
  ([key, { label }]) => ({
    label,
    value: key as MetricAggregationType,
  })
);

const toOption = (metric: MetricAggregation) => ({
  label: metricAggregationConfig[metric.type].label,
  value: metric.type,
});

interface QueryMetricEditorProps {
  metric: MetricAggregation;
}

export const MetricEditor: FunctionComponent<QueryMetricEditorProps> = ({ metric }) => {
  const styles = getStyles(useTheme(), metric.hide);
  const datasource = useDatasource();
  const dispatch = useDispatch<MetricAggregationAction>();

  const getFields = () => {
    if (metric.type === 'cardinality') {
      return datasource.getFields();
    }
    return datasource.getFields('number');
  };

  return (
    <>
      <InlineField label="Metric" labelWidth={15} className={cx(styles.color)}>
        <Segment
          className={cx(styles.color, marginZero)}
          // FIXME: This needs to be filtered by esVersion
          options={metricAggOptions}
          onChange={e => dispatch(changeMetricType(metric.id, e.value!))}
          value={toOption(metric)}
        />
      </InlineField>
      {metricAggregationConfig[metric.type].requiresField && (
        <SegmentAsync
          className={cx(styles.color)}
          loadOptions={getFields}
          onChange={() => {}}
          placeholder="Select Metric"
          value={metric.field}
        />
      )}

      <ToggleVisibilityButton onClick={() => dispatch(toggleMetricVisibility(metric.id))} hide={metric.hide} />
    </>
  );
};
