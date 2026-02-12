import { useState } from 'react';

import {
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceJsonDataOptionChecked,
  onUpdateDatasourceJsonDataOptionSelect,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { Combobox, Input, Space, Button, Field, Checkbox, Box } from '@grafana/ui';

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
    <Box width="50%">
      <Space v={3} />
      <Button
        icon={advancedDbConnectionSettingsIsOpen ? 'angle-down' : 'angle-right'}
        size="sm"
        variant="secondary"
        onClick={() => {
          trackInfluxDBConfigV2AdvancedDbConnectionSettingsToggleClicked();
          setAdvancedDbConnectionSettingsIsOpen(!advancedDbConnectionSettingsIsOpen);
        }}
      >
        Advanced Database Settings
      </Button>

      {advancedDbConnectionSettingsIsOpen && (
        <>
          <Space v={2} />
          {options.jsonData.version === InfluxVersion.InfluxQL && (
            <>
              <Field
                label="HTTP Method"
                description="You can use either GET or POST HTTP method to query your InfluxDB database. The POST
                          method allows you to perform heavy requests (with a lots of WHERE clause) while the GET method
                          will restrict you and return an error if the query is too large."
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
              <Space v={2} />
            </>
          )}

          {(options.jsonData.version === InfluxVersion.InfluxQL || options.jsonData.version === InfluxVersion.Flux) && (
            <>
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
              <Space v={2} />
            </>
          )}

          {options.jsonData.version === InfluxVersion.InfluxQL && (
            <>
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
              <Space v={2} />
            </>
          )}

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
          <Space v={2} />

          {options.jsonData.version === InfluxVersion.SQL && (
            <Checkbox
              data-testid="influxdb-v2-config-insecure-checkbox"
              label="Insecure Connection"
              onChange={(e) => {
                trackInfluxDBConfigV2AdvancedDbConnectionSettingsInsecureConnectClicked();
                onUpdateDatasourceJsonDataOptionChecked(props, 'insecureGrpc')(e);
              }}
              checked={options.jsonData.insecureGrpc ?? false}
            />
          )}
        </>
      )}
    </Box>
  );
};
