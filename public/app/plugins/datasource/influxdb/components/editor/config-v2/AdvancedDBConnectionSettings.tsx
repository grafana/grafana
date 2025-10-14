import { css } from '@emotion/css';
import { useState } from 'react';

import {
  GrafanaTheme2,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceJsonDataOptionChecked,
  onUpdateDatasourceJsonDataOptionSelect,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { InlineField, Combobox, InlineSwitch, Input, Space, Checkbox, Field, Button, Box } from '@grafana/ui';

import { InfluxVersion } from '../../../types';

import { HTTP_MODES } from './constants';
import {
  trackInfluxDBConfigV2AdvancedDbConnectionSettingsAutocompleteClicked,
  trackInfluxDBConfigV2AdvancedDbConnectionSettingsHTTPMethodClicked,
  trackInfluxDBConfigV2AdvancedDbConnectionSettingsInsecureConnectClicked,
  trackInfluxDBConfigV2AdvancedDbConnectionSettingsMaxSeriesClicked,
  trackInfluxDBConfigV2AdvancedDbConnectionSettingsMinTimeClicked,
  trackInfluxDBConfigV2AdvancedDbConnectionSettingsToggleClicked,
} from './tracking';
import { Props } from './types';

export const AdvancedDbConnectionSettings = (props: Props) => {
  const { options } = props;
  const [maxSeriesValue, setMaxSeriesValue] = useState(options.jsonData.maxSeries?.toString() || '');

  const [advancedDbConnectionSettingsIsOpen, setAdvancedDbConnectionSettingsIsOpen] = useState(
    () => !!options.jsonData.timeInterval || !!options.jsonData.insecureGrpc || !!options.jsonData.maxSeries
  );

  const onMaxSeriesChange = (e: { currentTarget: { value: string } }) => {
    setMaxSeriesValue(e.currentTarget.value);
    const val = parseInt(e.currentTarget.value, 10);
    updateDatasourcePluginJsonDataOption(props, 'maxSeries', Number.isFinite(val) ? val : undefined);
  };

  return (
    <>
      <Space v={1} />
      <Button
        icon={advancedDbConnectionSettingsIsOpen ? 'angle-down' : 'angle-right'}
        size="sm"
        variant="secondary"
        onClick={() => setAdvancedDbConnectionSettingsIsOpen(!advancedDbConnectionSettingsIsOpen)}
        onBlur={trackInfluxDBConfigV2AdvancedDbConnectionSettingsToggleClicked}
        data-testid="influxdb-v2-config-toggle-switch"
      >
        Advanced Database settings
      </Button>
      {advancedDbConnectionSettingsIsOpen && (
        <div style={{ marginTop: '10px', marginLeft: '30px' }}>
          {options.jsonData.version === InfluxVersion.InfluxQL && (
            <Box marginBottom={2}>
              <Field
                label="HTTP Method"
                description="POST allows you to perform heavy requests while GET will return an error if the query is too large"
                noMargin
              >
                <Combobox
                  value={HTTP_MODES.find((httpMode) => httpMode.value === options.jsonData.httpMode)}
                  options={HTTP_MODES}
                  onChange={onUpdateDatasourceJsonDataOptionSelect(props, 'httpMode')}
                  onBlur={trackInfluxDBConfigV2AdvancedDbConnectionSettingsHTTPMethodClicked}
                  data-testid="influxdb-v2-config-http-method-select"
                />
              </Field>
            </Box>
          )}

          {(options.jsonData.version === InfluxVersion.InfluxQL || options.jsonData.version === InfluxVersion.Flux) && (
            <Box marginBottom={2}>
              <Field
                label="Min time interval"
                description="A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example 1m if your data is written every minute."
                noMargin
              >
                <Input
                  data-testid="influxdb-v2-config-time-interval"
                  onBlur={trackInfluxDBConfigV2AdvancedDbConnectionSettingsMinTimeClicked}
                  onChange={onUpdateDatasourceJsonDataOption(props, 'timeInterval')}
                  placeholder="10s"
                  value={options.jsonData.timeInterval || ''}
                />
              </Field>
            </Box>
          )}

          {options.jsonData.version === InfluxVersion.InfluxQL && (
            <Box marginBottom={2}>
              <Field
                label="Autocomplete Range"
                description="This time range is used in the query editor's autocomplete to reduce the execution time of tag filter queries."
                noMargin
              >
                <Input
                  data-testid="influxdb-v2-config-autocomplete-range"
                  onBlur={trackInfluxDBConfigV2AdvancedDbConnectionSettingsAutocompleteClicked}
                  onChange={onUpdateDatasourceJsonDataOption(props, 'showTagTime')}
                  placeholder="12h"
                  value={options.jsonData.showTagTime || ''}
                />
              </Field>
            </Box>
          )}
          <Box marginBottom={2}>
            <Field
              label="Max series"
              description="Limit the number of series/tables that Grafana will process. Lower this number to prevent abuse, and increase it if you have lots of small time series and not all are shown. Defaults to 1000."
              noMargin
            >
              <Input
                data-testid="influxdb-v2-config-max-series"
                onBlur={trackInfluxDBConfigV2AdvancedDbConnectionSettingsMaxSeriesClicked}
                onChange={onMaxSeriesChange}
                placeholder="1000"
                value={maxSeriesValue}
                type="number"
              />
            </Field>
          </Box>

          {options.jsonData.version === InfluxVersion.SQL && (
            <Checkbox
              label="Insecure connection"
              data-testid="influxdb-v2-config-insecure-switch"
              value={options.jsonData.insecureGrpc ?? false}
              onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'insecureGrpc')}
              onBlur={trackInfluxDBConfigV2AdvancedDbConnectionSettingsInsecureConnectClicked}
            />
          )}
        </div>
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
  };
};
