import { uniqueId } from 'lodash';
import React, { ComponentProps, useRef, useState } from 'react';

import { InlineField, Input, InlineSwitch, Select } from '@grafana/ui';

import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { extendedStats } from '../../../../queryDef';
import { useQuery } from '../../ElasticsearchQueryContext';
import { SettingsEditorContainer } from '../../SettingsEditorContainer';
import {
  MetricAggregation,
  isMetricAggregationWithInlineScript,
  isMetricAggregationWithMissingSupport,
  ExtendedStat,
} from '../aggregations';
import { changeMetricMeta, changeMetricSetting } from '../state/actions';
import { metricAggregationConfig } from '../utils';

import { BucketScriptSettingsEditor } from './BucketScriptSettingsEditor';
import { MovingAverageSettingsEditor } from './MovingAverageSettingsEditor';
import { SettingField } from './SettingField';
import { TopMetricsSettingsEditor } from './TopMetricsSettingsEditor';
import { useDescription } from './useDescription';

// TODO: Move this somewhere and share it with BucketsAggregation Editor
const inlineFieldProps: Partial<ComponentProps<typeof InlineField>> = {
  labelWidth: 16,
};

interface Props {
  metric: MetricAggregation;
  previousMetrics: MetricAggregation[];
}

export const SettingsEditor = ({ metric, previousMetrics }: Props) => {
  const { current: baseId } = useRef(uniqueId('es-setting-'));

  const dispatch = useDispatch();
  const description = useDescription(metric);
  const query = useQuery();

  const rateAggUnitOptions = [
    { value: 'second', label: 'Second' },
    { value: 'minute', label: 'Minute' },
    { value: 'hour', label: 'Hour' },
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'quarter', label: 'Quarter' },
    { value: 'Year', label: 'Year' },
  ];

  const rateAggModeOptions = [
    { value: 'sum', label: 'Sum' },
    { value: 'value_count', label: 'Value count' },
  ];

  return (
    <SettingsEditorContainer label={description} hidden={metric.hide}>
      {metric.type === 'derivative' && <SettingField label="Unit" metric={metric} settingName="unit" />}

      {metric.type === 'serial_diff' && <SettingField label="Lag" metric={metric} settingName="lag" placeholder="1" />}

      {metric.type === 'cumulative_sum' && <SettingField label="Format" metric={metric} settingName="format" />}

      {metric.type === 'moving_avg' && <MovingAverageSettingsEditor metric={metric} />}

      {metric.type === 'moving_fn' && (
        <>
          <SettingField label="Window" metric={metric} settingName="window" />
          <SettingField label="Script" metric={metric} settingName="script" />
          <SettingField label="Shift" metric={metric} settingName="shift" />
        </>
      )}

      {metric.type === 'top_metrics' && <TopMetricsSettingsEditor metric={metric} />}

      {metric.type === 'bucket_script' && (
        <BucketScriptSettingsEditor value={metric} previousMetrics={previousMetrics} />
      )}

      {(metric.type === 'raw_data' || metric.type === 'raw_document') && (
        <InlineField label="Size" {...inlineFieldProps}>
          <Input
            id={`ES-query-${query.refId}_metric-${metric.id}-size`}
            onBlur={(e) => dispatch(changeMetricSetting({ metric, settingName: 'size', newValue: e.target.value }))}
            defaultValue={metric.settings?.size ?? metricAggregationConfig['raw_data'].defaults.settings?.size}
          />
        </InlineField>
      )}

      {metric.type === 'logs' && <SettingField label="Limit" metric={metric} settingName="limit" placeholder="500" />}

      {metric.type === 'cardinality' && (
        <SettingField label="Precision Threshold" metric={metric} settingName="precision_threshold" />
      )}

      {metric.type === 'extended_stats' && (
        <>
          {extendedStats.map((stat) => (
            <ExtendedStatSetting
              key={stat.value}
              stat={stat}
              onChange={(newValue) => dispatch(changeMetricMeta({ metric, meta: stat.value, newValue }))}
              value={
                metric.meta?.[stat.value] !== undefined
                  ? !!metric.meta?.[stat.value]
                  : !!metricAggregationConfig['extended_stats'].defaults.meta?.[stat.value]
              }
            />
          ))}

          <SettingField label="Sigma" metric={metric} settingName="sigma" placeholder="3" />
        </>
      )}

      {metric.type === 'percentiles' && (
        <InlineField label="Percentiles" {...inlineFieldProps}>
          <Input
            id={`${baseId}-percentiles-percents`}
            onBlur={(e) =>
              dispatch(
                changeMetricSetting({
                  metric,
                  settingName: 'percents',
                  newValue: e.target.value.split(',').filter(Boolean),
                })
              )
            }
            defaultValue={
              metric.settings?.percents || metricAggregationConfig['percentiles'].defaults.settings?.percents
            }
            placeholder="1,5,25,50,75,95,99"
          />
        </InlineField>
      )}

      {metric.type === 'rate' && (
        <>
          <InlineField label="Unit" {...inlineFieldProps} data-testid="unit-select">
            <Select
              id={`ES-query-${query.refId}_metric-${metric.id}-unit`}
              onChange={(e) => dispatch(changeMetricSetting({ metric, settingName: 'unit', newValue: e.value }))}
              options={rateAggUnitOptions}
              value={metric.settings?.unit}
            />
          </InlineField>

          <InlineField label="Mode" {...inlineFieldProps} data-testid="mode-select">
            <Select
              id={`ES-query-${query.refId}_metric-${metric.id}-mode`}
              onChange={(e) => dispatch(changeMetricSetting({ metric, settingName: 'mode', newValue: e.value }))}
              options={rateAggModeOptions}
              value={metric.settings?.unit}
            />
          </InlineField>
        </>
      )}

      {isMetricAggregationWithInlineScript(metric) && (
        <SettingField label="Script" metric={metric} settingName="script" placeholder="_value * 1" />
      )}

      {isMetricAggregationWithMissingSupport(metric) && (
        <SettingField
          label="Missing"
          metric={metric}
          settingName="missing"
          tooltip="The missing parameter defines how documents that are missing a value should be treated. By default
            they will be ignored but it is also possible to treat them as if they had a value"
        />
      )}
    </SettingsEditorContainer>
  );
};

interface ExtendedStatSettingProps {
  stat: ExtendedStat;
  onChange: (checked: boolean) => void;
  value: boolean;
}
const ExtendedStatSetting = ({ stat, onChange, value }: ExtendedStatSettingProps) => {
  // this is needed for the htmlFor prop in the label so that clicking the label will toggle the switch state.
  const [id] = useState(uniqueId(`es-field-id-`));

  return (
    <InlineField label={stat.label} {...inlineFieldProps} key={stat.value}>
      <InlineSwitch
        id={id}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        value={value}
      />
    </InlineField>
  );
};
