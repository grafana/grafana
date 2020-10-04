import { SelectableValue } from '@grafana/data';
import { Icon, InlineField, Segment, SegmentAsync, useTheme } from '@grafana/ui';
import { cx } from 'emotion';
import React, { FunctionComponent, useCallback } from 'react';
import { metricAggregationConfig } from '../../query_def';
import { useDatasource } from '../ElasticsearchQueryContext';
import { getStyles } from './styles';
import { marginZero } from '../styles';
import { MetricAggregation, MetricAggregationType } from '../../state/metricAggregation/types';

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

  const onMetricTypeChange = useCallback(
    ({ value: type }) => {
      if (type === undefined || type === metric.type) {
        // If we are selecting the same type we do nothing.
        return;
      }
      // TODO: When changing metric type we should generate a new metric with that type
      // And if the selected field can't be used for that metric we should clear it out.
      // eg. Unique count with non-numeric field and then change type to eg. Average
      // onChange({ ...metric, type });
    },
    [metric]
  );

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
          onChange={onMetricTypeChange}
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

      <button className={cx('gf-form-label gf-form-label--btn query-part', styles.color)} onClick={() => {}}>
        <Icon name={metric.hide ? 'eye-slash' : 'eye'} />
      </button>
    </>
  );
};
