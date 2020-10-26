import React, { ComponentProps } from 'react';
import { InlineField, Input } from '@grafana/ui';
import { useDispatch } from '../../ElasticsearchQueryContext';
import { changeMetricSetting } from '../state/actions';
import { MetricAggregationWithSettings, ChangeMetricSettingAction } from '../state/types';
import { SettingKeyOf } from '../../types';

interface Props<T extends MetricAggregationWithSettings, K extends SettingKeyOf<T>> {
  label: string;
  settingName: K;
  metric: T;
  placeholder?: ComponentProps<typeof Input>['placeholder'];
  tooltip?: ComponentProps<typeof InlineField>['tooltip'];
}

export function SettingField<T extends MetricAggregationWithSettings, K extends SettingKeyOf<T>>({
  label,
  settingName,
  metric,
  placeholder,
  tooltip,
}: Props<T, K>) {
  const dispatch = useDispatch<ChangeMetricSettingAction<T>>();
  const settings = metric.settings;

  return (
    <InlineField label={label} labelWidth={16} tooltip={tooltip}>
      <Input
        placeholder={placeholder}
        onBlur={e => dispatch(changeMetricSetting(metric, settingName, e.target.value))}
        defaultValue={settings?.[settingName as keyof typeof settings]}
      />
    </InlineField>
  );
}
