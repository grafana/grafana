import { Icon, InlineField, Input } from '@grafana/ui';
import { css, cx } from 'emotion';
import React, { FunctionComponent, useState, ComponentProps } from 'react';
import { MetricAggregation } from './state/types';
import { justifyStart } from './styles';
import { metricAggregationConfig } from './utils';

const inlineFieldProps: Partial<ComponentProps<typeof InlineField>> = {
  labelWidth: 15,
};

interface Props {
  metric: MetricAggregation;
}

export const SettingsEditor: FunctionComponent<Props> = ({ metric }) => {
  const [open, setOpen] = useState(false);

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
        // FIXME: Count metric shouldn't have settings
        <>
          {metric.type === 'derivative' && (
            // TODO: onBlur, defaultValue
            <InlineField label="Unit" {...inlineFieldProps}>
              <Input value={metric.settings?.unit ?? ''} />
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

          {metricAggregationConfig[metric.type].supportsInlineScript && (
            <InlineField label="Script" {...inlineFieldProps}>
              <Input placeholder="_value * 1" />
            </InlineField>
          )}

          {metricAggregationConfig[metric.type].supportsMissing && (
            <InlineField
              tooltip="The missing parameter defines how documents that are missing a value should be treated. By default
            they will be ignored but it is also possible to treat them as if they had a value"
              label="Missing"
              {...inlineFieldProps}
            >
              <Input />
            </InlineField>
          )}
        </>
      )}
    </>
  );
};
