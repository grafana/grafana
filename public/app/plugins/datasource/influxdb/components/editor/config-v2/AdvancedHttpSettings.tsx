import { cx } from '@emotion/css';
import { useState } from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import {
  Box,
  InlineField,
  InlineSwitch,
  Field,
  TagsInput,
  Input,
  CustomHeadersSettings,
  useStyles2,
} from '@grafana/ui';

import { InfluxOptions } from '../../../types';

import { getInlineLabelStyles } from './constants';
import {
  trackInfluxDBConfigV2AdvancedHTTPSettingsTimeoutField,
  trackInfluxDBConfigV2AdvancedHTTPSettingsToggleClicked,
} from './tracking';

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

export const AdvancedHttpSettings = ({ options, onOptionsChange }: Props) => {
  const styles = useStyles2(getInlineLabelStyles);

  const [advancedHttpSettingsIsOpen, setAdvancedHttpSettingsIsOpen] = useState(
    () => 'keepCookies' in options.jsonData || 'timeout' in options.jsonData
  );

  return (
    <>
      <Box display="flex" alignItems="center">
        <InlineField label={<div className={cx(styles.label)}>Advanced HTTP Settings</div>} labelWidth={40}>
          <InlineSwitch
            data-testid="influxdb-v2-config-advanced-http-settings-toggle"
            value={advancedHttpSettingsIsOpen}
            onChange={() => setAdvancedHttpSettingsIsOpen(!advancedHttpSettingsIsOpen)}
            onBlur={trackInfluxDBConfigV2AdvancedHTTPSettingsToggleClicked}
          />
        </InlineField>
      </Box>
      {advancedHttpSettingsIsOpen && options.access === 'proxy' && (
        <>
          <Box paddingLeft={1} marginY={1}>
            <Box width="50%" marginBottom={2}>
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
            </Box>

            <Box width="50%" marginBottom={2}>
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
            </Box>

            {advancedHttpSettingsIsOpen && (
              <CustomHeadersSettings dataSourceConfig={options} onChange={onOptionsChange} />
            )}
          </Box>
        </>
      )}
    </>
  );
};
