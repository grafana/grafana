import { InlineField, Input, Switch } from '@grafana/ui';
import React, { FunctionComponent, ComponentProps } from 'react';
import { extendedStats } from '../../../query_def';
import { useDispatch } from '../../../hooks/useStatelessReducer';
import { changeMetricMeta, changeMetricSetting } from '../state/actions';
import {
  MetricAggregation,
  isMetricAggregationWithInlineScript,
  isMetricAggregationWithMissingSupport,
} from '../aggregations';
import { BucketScriptSettingsEditor } from './BucketScriptSettingsEditor';
import { SettingField } from './SettingField';
import { SettingsEditorContainer } from '../../SettingsEditorContainer';
import { useDescription } from './useDescription';
import { MovingAverageSettingsEditor } from './MovingAverageSettingsEditor';

// TODO: Move this somewhere and share it with BucketsAggregation Editor
const inlineFieldProps: Partial<ComponentProps<typeof InlineField>> = {
  labelWidth: 16,
};

interface Props {
  metric: MetricAggregation;
  previousMetrics: MetricAggregation[];
}

export const SettingsEditor: FunctionComponent<Props> = ({ metric, previousMetrics }) => {
  const dispatch = useDispatch();
  const description = useDescription(metric);

  return (
    <SettingsEditorContainer label={description}>
      {metric.type === 'derivative' && <SettingField label="Unit" metric={metric} settingName="unit" />}

      {metric.type === 'cumulative_sum' && <SettingField label="Format" metric={metric} settingName="format" />}

      {metric.type === 'moving_avg' && <MovingAverageSettingsEditor metric={metric} />}

      {metric.type === 'moving_fn' && (
        <>
          <SettingField label="Window" metric={metric} settingName="window" />
          <SettingField label="Script" metric={metric} settingName="script" />
          <SettingField label="Shift" metric={metric} settingName="shift" />
        </>
      )}

      {metric.type === 'bucket_script' && (
        <BucketScriptSettingsEditor value={metric} previousMetrics={previousMetrics} />
      )}

      {(metric.type === 'raw_data' || metric.type === 'raw_document') && (
        <InlineField label="Size" {...inlineFieldProps}>
          <Input
            onBlur={e => dispatch(changeMetricSetting(metric, 'size', e.target.value))}
            // TODO: this should be set somewhere else
            defaultValue={metric.settings?.size ?? '500'}
          />
        </InlineField>
      )}

      {metric.type === 'cardinality' && (
        <SettingField label="Precision Threshold" metric={metric} settingName="precision_threshold" />
      )}

      {metric.type === 'extended_stats' && (
        <>
          {extendedStats.map(stat => (
            <InlineField label={stat.label} {...inlineFieldProps} key={stat.value}>
              <Switch
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  dispatch(changeMetricMeta(metric, stat.value, e.target.checked))
                }
                value={!!metric.meta?.[stat.value]}
              />
            </InlineField>
          ))}

          <SettingField label="Sigma" metric={metric} settingName="sigma" placeholder="3" />
        </>
      )}

      {metric.type === 'percentiles' && (
        <InlineField label="Percentiles" {...inlineFieldProps}>
          <Input
            onBlur={e => dispatch(changeMetricSetting(metric, 'percents', e.target.value.split(',').filter(Boolean)))}
            defaultValue={metric.settings?.percents}
            placeholder="1,5,25,50,75,95,99"
          />
        </InlineField>
      )}

      {isMetricAggregationWithInlineScript(metric) && (
        <SettingField label="Script" metric={metric} settingName="script" placeholder="_value * 1" />
      )}

      {isMetricAggregationWithMissingSupport(metric) && (
        <SettingField
          label="Missing"
          metric={metric}
          settingName="missing"
          // TODO: This should be better formatted.
          tooltip="The missing parameter defines how documents that are missing a value should be treated. By default
            they will be ignored but it is also possible to treat them as if they had a value"
        />
      )}
    </SettingsEditorContainer>
  );
};
