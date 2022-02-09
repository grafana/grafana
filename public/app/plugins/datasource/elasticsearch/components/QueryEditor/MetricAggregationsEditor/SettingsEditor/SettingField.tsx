import React, { ComponentProps, useState } from 'react';
import { InlineField, Input } from '@grafana/ui';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { changeMetricSetting } from '../state/actions';
import { SettingKeyOf } from '../../../types';
import { MetricAggregationWithInlineScript, MetricAggregationWithSettings } from '../aggregations';
import { uniqueId } from 'lodash';
import { getScriptValue } from 'app/plugins/datasource/elasticsearch/utils';

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
  const dispatch = useDispatch();
  const [id] = useState(uniqueId(`es-field-id-`));
  const settings = metric.settings;

  let defaultValue = settings?.[settingName as keyof typeof settings] || '';

  if (settingName === 'script') {
    defaultValue = getScriptValue(metric as MetricAggregationWithInlineScript);
  }

  return (
    <InlineField label={label} labelWidth={16} tooltip={tooltip}>
      <Input
        id={id}
        placeholder={placeholder}
        onBlur={(e) => dispatch(changeMetricSetting({ metric, settingName, newValue: e.target.value }))}
        defaultValue={defaultValue}
      />
    </InlineField>
  );
}
