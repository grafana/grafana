import { Icon, InlineField, Input, Switch } from '@grafana/ui';
import { css, cx } from 'emotion';
import React, { FunctionComponent, useState, ComponentProps } from 'react';
import { extendedStats } from '../../query_def';
import { useDispatch } from '../ElasticsearchQueryContext';
import { changeMetricSetting } from './state/actions';
import {
  isMetricAggregationWithInlineScript,
  isMetricAggregationWithMissingSupport,
  MetricAggregation,
} from './state/types';
import { justifyStart } from './styles';

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
            // TODO: onBlur, defaultValue
            <InlineField label="Format" {...inlineFieldProps}>
              <Input value={metric.settings?.format ?? ''} />
            </InlineField>
          )}

          {metric.type === 'moving_avg' && (
            // TODO: onBlur, defaultValue
            <>Moving average settings</>
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
            >
              <Input
                onBlur={e => dispatch(changeMetricSetting(metric, 'missing', e.target.value))}
                type="number"
                defaultValue={metric.settings?.missing}
              />
            </InlineField>
          )}
        </>
      )}
    </>
  );
};
