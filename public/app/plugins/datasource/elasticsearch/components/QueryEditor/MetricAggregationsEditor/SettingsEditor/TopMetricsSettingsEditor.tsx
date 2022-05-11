import { css } from '@emotion/css';
import React, { FunctionComponent } from 'react';

import { SelectableValue } from '@grafana/data';
import { AsyncMultiSelect, InlineField, SegmentAsync, Select } from '@grafana/ui';

import { useFields } from '../../../../hooks/useFields';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { orderOptions } from '../../BucketAggregationsEditor/utils';
import { TopMetrics } from '../aggregations';
import { changeMetricSetting } from '../state/actions';

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
              changeMetricSetting({
                metric,
                settingName: 'metrics',
                newValue: e.map((v) => v.value!),
              })
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
          onChange={(e) => dispatch(changeMetricSetting({ metric, settingName: 'order', newValue: e.value }))}
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
          onChange={(e) => dispatch(changeMetricSetting({ metric, settingName: 'orderBy', newValue: e.value }))}
          placeholder="Select Field"
          value={metric.settings?.orderBy}
        />
      </InlineField>
    </>
  );
};
