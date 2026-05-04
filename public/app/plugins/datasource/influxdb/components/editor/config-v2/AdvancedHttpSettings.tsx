import { useState } from 'react';

import { type DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { Box, Button, Field, TagsInput, Input, CustomHeadersSettings, Space } from '@grafana/ui';

import { type InfluxOptions } from '../../../types';

import {
  trackInfluxDBConfigV2AdvancedHTTPSettingsTimeoutField,
  trackInfluxDBConfigV2AdvancedHTTPSettingsToggleClicked,
} from './tracking';

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

export const AdvancedHttpSettings = ({ options, onOptionsChange }: Props) => {
  const [advancedHttpSettingsIsOpen, setAdvancedHttpSettingsIsOpen] = useState(() => {
    const keys = Object.keys(options.jsonData);
    return (
      'keepCookies' in options.jsonData ||
      'timeout' in options.jsonData ||
      keys.some((key) => key.includes('httpHeaderName'))
    );
  });

  return (
    <Box width="50%">
      <Space v={3} />
      <Button
        data-testid="influxdb-v2-config-advanced-http-settings-toggle"
        icon={advancedHttpSettingsIsOpen ? 'angle-down' : 'angle-right'}
        size="sm"
        variant="secondary"
        onClick={() => {
          trackInfluxDBConfigV2AdvancedHTTPSettingsToggleClicked();
          setAdvancedHttpSettingsIsOpen(!advancedHttpSettingsIsOpen);
        }}
      >
        Advanced HTTP Settings
      </Button>
      {advancedHttpSettingsIsOpen && options.access === 'proxy' && (
        <>
          <Space v={2} />
          <Field
            label="Allowed cookies"
            description="Grafana proxy deletes forwarded cookies by default. Specify cookies by name that should
            be forwarded to the data source."
            disabled={options.readOnly}
            noMargin
          >
            <TagsInput
              id="advanced-http-cookies"
              placeholder="New cookie (hit enter to add)"
              tags={
                'keepCookies' in options.jsonData && Array.isArray(options.jsonData.keepCookies)
                  ? options.jsonData.keepCookies
                  : []
              }
              onChange={(e) => {
                onOptionsChange({
                  ...options,
                  jsonData: {
                    ...options.jsonData,
                    ...{ keepCookies: e },
                  },
                });
              }}
            />
          </Field>
          <Space v={2} />
          <Field
            htmlFor="advanced-http-timeout"
            label="Timeout"
            description="HTTP request timeout in seconds."
            disabled={options.readOnly}
            noMargin
          >
            <Input
              id="advanced-http-timeout"
              type="number"
              min={0}
              placeholder="Timeout in seconds"
              aria-label="Timeout in seconds"
              value={
                'timeout' in options.jsonData && typeof options.jsonData.timeout === 'number'
                  ? options.jsonData.timeout.toString()
                  : ''
              }
              onChange={(e) => {
                const parsed = parseInt(e.currentTarget.value, 10);
                onOptionsChange({
                  ...options,
                  jsonData: {
                    ...options.jsonData,
                    ...{ timeout: parsed },
                  },
                });
              }}
              onBlur={trackInfluxDBConfigV2AdvancedHTTPSettingsTimeoutField}
            />
          </Field>
          <Space v={2} />
          <CustomHeadersSettings dataSourceConfig={options} onChange={onOptionsChange} />
        </>
      )}
      <Space v={3} />
    </Box>
  );
};
