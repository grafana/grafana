import { Icon, InlineField, Input, Select, Switch } from '@grafana/ui';
import { css, cx } from 'emotion';
import React, { FunctionComponent, useState, ComponentProps } from 'react';
import { extendedStats, movingAvgModelOptions, movingAvgModelSettings } from '../../query_def';
import { useDispatch } from '../ElasticsearchQueryContext';
import { changeMetricSetting } from './state/actions';
import {
  isMetricAggregationWithInlineScript,
  isMetricAggregationWithMissingSupport,
  MetricAggregation,
} from './state/types';
import { justifyStart } from './styles';
import { isValidNumber } from './utils';

const inlineFieldProps: Partial<ComponentProps<typeof InlineField>> = {
  labelWidth: 15,
};

interface Props {
  metric: MetricAggregation;
}

export const SettingsEditor: FunctionComponent<Props> = ({ metric }) => {
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();

  if (metric.type === 'count') {
    return null;
  }

  return (
    <>
      <button
        className={cx(
          'gf-form-label',
          justifyStart,
          open &&
            css`
              margin: 0 4px 4px 0;
            `
        )}
        onClick={() => setOpen(!open)}
      >
        <Icon name={open ? 'angle-down' : 'angle-right'} />
        Settings
      </button>

      {open && (
        <>
          {metric.type === 'derivative' && (
            <InlineField label="Unit" {...inlineFieldProps}>
              <Input
                onBlur={e => dispatch(changeMetricSetting(metric, 'unit', e.target.value))}
                defaultValue={metric.settings?.unit}
              />
            </InlineField>
          )}

          {metric.type === 'cumulative_sum' && (
            <InlineField label="Format" {...inlineFieldProps}>
              <Input
                defaultValue={metric.settings?.format}
                onBlur={e => dispatch(changeMetricSetting(metric, 'format', e.target.value))}
              />
            </InlineField>
          )}

          {metric.type === 'moving_avg' && (
            // TODO: onBlur, defaultValue
            <>
              <InlineField label="Model" {...inlineFieldProps}>
                <Select
                  onChange={value => dispatch(changeMetricSetting(metric, 'model', value.value!))}
                  options={movingAvgModelOptions}
                  defaultValue={
                    movingAvgModelOptions.find(m => m.value === metric.settings?.model) || movingAvgModelOptions[0]
                  }
                />
              </InlineField>
              <InlineField label="Window" {...inlineFieldProps} invalid={!isValidNumber(metric.settings?.window)}>
                <Input
                  defaultValue={metric.settings?.window || '5'}
                  onBlur={e => dispatch(changeMetricSetting(metric, 'window', e.target.value))}
                />
              </InlineField>

              <InlineField label="Predict" {...inlineFieldProps} invalid={!isValidNumber(metric.settings?.predict)}>
                <Input
                  defaultValue={metric.settings?.predict}
                  onBlur={e => dispatch(changeMetricSetting(metric, 'predict', e.target.value))}
                />
              </InlineField>

              {movingAvgModelSettings[metric.settings?.model || 'simple'].map(modelOption => {
                // FIXME: This is kinda ugly and types are not perfect. Need to give it a second shot.
                const InputComponent = modelOption.type === 'boolean' ? Switch : Input;
                const componentChangeEvent = modelOption.type === 'boolean' ? 'onChange' : 'onBlur';
                const eventAttr = modelOption.type === 'boolean' ? 'checked' : 'value';
                const componentChangeHandler = (e: any) =>
                  dispatch(changeMetricSetting(metric, modelOption.value, (e.target as any)[eventAttr]));

                return (
                  <InlineField label={modelOption.label} {...inlineFieldProps} key={modelOption.value}>
                    <InputComponent
                      defaultValue={metric.settings?.[modelOption.value]}
                      {...{
                        [componentChangeEvent]: componentChangeHandler,
                      }}
                    />
                  </InlineField>
                );
              })}
            </>
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
            <InlineField label="Percentiles" {...inlineFieldProps}>
              <Input
                onBlur={e => dispatch(changeMetricSetting(metric, 'precision_threshold', e.target.value))}
                defaultValue={metric.settings?.precision_threshold ?? ''}
              />
            </InlineField>
          )}

          {metric.type === 'extended_stats' && (
            <>
              {extendedStats.map(stat => (
                <InlineField label={stat.text} {...inlineFieldProps} key={stat.value}>
                  <Switch
                    // FIXME: Performance of this is kinda bad, need to investigate
                    onChange={e => dispatch(changeMetricSetting(metric, stat.value, (e.target as any).checked))}
                    value={metric.settings?.[stat.value] ?? stat.default}
                  />
                </InlineField>
              ))}
              <InlineField label="Sigma" {...inlineFieldProps}>
                <Input
                  placeholder="3"
                  onBlur={e => dispatch(changeMetricSetting(metric, 'sigma', e.target.value))}
                  defaultValue={metric.settings?.sigma}
                />
              </InlineField>
            </>
          )}

          {metric.type === 'percentiles' && (
            <InlineField label="Percentiles" {...inlineFieldProps}>
              <Input
                onBlur={e => dispatch(changeMetricSetting(metric, 'percentiles', e.target.value))}
                // TODO: This should be set somewhere else
                defaultValue={metric.settings?.percentiles ?? '25,50,75,95,99'}
              />
            </InlineField>
          )}

          {isMetricAggregationWithInlineScript(metric) && (
            <InlineField label="Script" {...inlineFieldProps}>
              <Input
                placeholder="_value * 1"
                onBlur={e => dispatch(changeMetricSetting(metric, 'script', e.target.value))}
                defaultValue={metric.settings?.script}
              />
            </InlineField>
          )}

          {isMetricAggregationWithMissingSupport(metric) && (
            <InlineField
              tooltip="The missing parameter defines how documents that are missing a value should be treated. By default
            they will be ignored but it is also possible to treat them as if they had a value"
              label="Missing"
              {...inlineFieldProps}
              invalid={!isValidNumber(metric.settings?.missing)}
            >
              <Input
                onBlur={e => dispatch(changeMetricSetting(metric, 'missing', e.target.value))}
                defaultValue={metric.settings?.missing}
              />
            </InlineField>
          )}
        </>
      )}
    </>
  );
};
