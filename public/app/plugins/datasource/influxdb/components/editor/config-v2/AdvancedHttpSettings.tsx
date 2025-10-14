import { css } from '@emotion/css';
import { useState } from 'react';

import { DataSourcePluginOptionsEditorProps, GrafanaTheme2 } from '@grafana/data';
import { Box, Field, TagsInput, Input, CustomHeadersSettings, useStyles2, Stack, Button } from '@grafana/ui';

import { InfluxOptions } from '../../../types';

import {
  trackInfluxDBConfigV2AdvancedHTTPSettingsTimeoutField,
  trackInfluxDBConfigV2AdvancedHTTPSettingsToggleClicked,
} from './tracking';

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

export const AdvancedHttpSettings = ({ options, onOptionsChange }: Props) => {
  const styles = useStyles2(getStyles);

  const [advancedHttpSettingsIsOpen, setAdvancedHttpSettingsIsOpen] = useState(() => {
    const keys = Object.keys(options.jsonData);
    return (
      'keepCookies' in options.jsonData ||
      'timeout' in options.jsonData ||
      keys.some((key) => key.includes('httpHeaderName'))
    );
  });

  return (
    <>
      <Box display="flex" alignItems="center">
        <Button
          icon={advancedHttpSettingsIsOpen ? 'angle-down' : 'angle-right'}
          size="sm"
          variant="secondary"
          onClick={() => setAdvancedHttpSettingsIsOpen(!advancedHttpSettingsIsOpen)}
          className={styles.httpSettingsButton}
          onBlur={trackInfluxDBConfigV2AdvancedHTTPSettingsToggleClicked}
          data-testid="influxdb-v2-config-advanced-http-settings-toggle"
        >
          Advanced HTTP settings
        </Button>
      </Box>
      {advancedHttpSettingsIsOpen && options.access === 'proxy' && (
        <>
          <Stack direction="row" wrap="wrap" justifyContent="space-between">
            <div className={styles.col}>
              <Box width="100%" minWidth={37} marginBottom={2}>
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
            </div>
            <div className={styles.col}>
              <Box width="100%" minWidth={37} marginBottom={2}>
                <Field
                  htmlFor="advanced-http-timeout"
                  label="Timeout"
                  description={
                    <div style={{ display: 'flex', alignItems: 'center', height: '30px' }}>
                      HTTP request timeout in seconds
                    </div>
                  }
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
            </div>
          </Stack>
          {advancedHttpSettingsIsOpen && (
            <div style={{ marginLeft: '30px' }}>
              <CustomHeadersSettings dataSourceConfig={options} onChange={onOptionsChange} />
            </div>
          )}
        </>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    label: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
      padding: theme.spacing(0, 1),
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.size.md,
      backgroundColor: theme.colors.background.secondary,
      height: theme.spacing(theme.components.height.md),
      lineHeight: theme.spacing(theme.components.height.md),
      marginRight: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      border: 'none',
      width: '220px',
      color: theme.colors.text.primary,
    }),
    col: css({
      marginLeft: '30px',
      flex: '1 1 40%',
      minWidth: '360px',
    }),
    '@media (max-width: 768px)': {
      flexBasis: '100%',
    },
    httpSettingsSection: css({ marginTop: theme.spacing(2) }),
    httpSettingsButton: css({ marginBottom: theme.spacing(2) }),
  };
};
