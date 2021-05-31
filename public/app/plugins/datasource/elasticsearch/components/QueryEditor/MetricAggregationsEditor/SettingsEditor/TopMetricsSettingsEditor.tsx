import { AsyncMultiSelect, InlineField, SegmentAsync, Select } from '@grafana/ui';
import React, { FunctionComponent } from 'react';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { useFields } from '../../../../hooks/useFields';
import { TopMetrics } from '../aggregations';
import { changeMetricSetting } from '../state/actions';
import { orderOptions } from '../../BucketAggregationsEditor/utils';
import { css } from '@emotion/css';
import { SelectableValue } from '@grafana/data';

interface Props {
  metric: TopMetrics;
}

const toMultiSelectValue = (value: string): SelectableValue<string> => ({ value, label: value });

export const TopMetricsSettingsEditor: FunctionComponent<Props> = ({ metric }) => {
  const dispatch = useDispatch();
  const getOrderByOptions = useFields(['number', 'date']);
  const getMetricsOptions = useFields(metric.type);

  return (
    <>
      <InlineField label="Metrics" labelWidth={16}>
        <AsyncMultiSelect
          onChange={(e) =>
            dispatch(
              changeMetricSetting(
                metric,
                'metrics',
                e.map((v) => v.value!)
              )
            )
          }
          loadOptions={getMetricsOptions}
          value={metric.settings?.metrics?.map(toMultiSelectValue)}
          closeMenuOnSelect={false}
          defaultOptions
        />
      </InlineField>
      <InlineField label="Order" labelWidth={16}>
        <Select
          onChange={(e) => dispatch(changeMetricSetting(metric, 'order', e.value))}
          options={orderOptions}
          value={metric.settings?.order}
        />
      </InlineField>
      <InlineField
        label="Order By"
        labelWidth={16}
        className={css`
          & > div {
            width: 100%;
          }
        `}
      >
        <SegmentAsync
          className={css`
            margin-right: 0;
          `}
          loadOptions={getOrderByOptions}
          onChange={(e) => dispatch(changeMetricSetting(metric, 'orderBy', e.value))}
          placeholder="Select Field"
          value={metric.settings?.orderBy}
        />
      </InlineField>
    </>
  );
};
