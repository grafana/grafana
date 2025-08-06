import { cx } from '@emotion/css';
import { useState } from 'react';

import {
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceJsonDataOptionChecked,
  onUpdateDatasourceJsonDataOptionSelect,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { InlineFieldRow, InlineField, Combobox, InlineSwitch, Input, Space, useStyles2 } from '@grafana/ui';

import { InfluxVersion } from '../../../types';

import { getInlineLabelStyles, HTTP_MODES } from './constants';
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
  const styles = useStyles2(getInlineLabelStyles);
  const [maxSeriesValue, setMaxSeriesValue] = useState(options.jsonData.maxSeries?.toString() || '');

  const [advancedDbConnectionSettingsIsOpen, setAdvancedDbConnectionSettingsIsOpen] = useState(
    () => !!options.jsonData.timeInterval || !!options.jsonData.insecureGrpc
  );

  return (
    <>
      <Space v={2} />
      <InlineField label={<div className={cx(styles.label)}>Advanced Database Settings</div>} labelWidth={40}>
        <InlineSwitch
          data-testid="influxdb-v2-config-toggle-switch"
          value={advancedDbConnectionSettingsIsOpen}
          onChange={() => setAdvancedDbConnectionSettingsIsOpen(!advancedDbConnectionSettingsIsOpen)}
          onBlur={trackInfluxDBConfigV2AdvancedDbConnectionSettingsToggleClicked}
        />
      </InlineField>

      {advancedDbConnectionSettingsIsOpen && (
        <>
          {options.jsonData.version === InfluxVersion.InfluxQL && (
            <InlineFieldRow>
              <InlineField
                label="HTTP Method"
                labelWidth={30}
                tooltip="You can use either GET or POST HTTP method to query your InfluxDB database. The POST
                        method allows you to perform heavy requests (with a lots of WHERE clause) while the GET method
                        will restrict you and return an error if the query is too large."
              >
                <Combobox
                  width={30}
                  value={HTTP_MODES.find((httpMode) => httpMode.value === options.jsonData.httpMode)}
                  options={HTTP_MODES}
                  onChange={onUpdateDatasourceJsonDataOptionSelect(props, 'httpMode')}
                  onBlur={trackInfluxDBConfigV2AdvancedDbConnectionSettingsHTTPMethodClicked}
                  data-testid="influxdb-v2-config-http-method-select"
                />
              </InlineField>
            </InlineFieldRow>
          )}

          {options.jsonData.version === InfluxVersion.SQL && (
            <InlineFieldRow>
              <InlineField label="Insecure Connection" labelWidth={30}>
                <InlineSwitch
                  data-testid="influxdb-v2-config-insecure-switch"
                  value={options.jsonData.insecureGrpc ?? false}
                  onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'insecureGrpc')}
                  onBlur={trackInfluxDBConfigV2AdvancedDbConnectionSettingsInsecureConnectClicked}
                />
              </InlineField>
            </InlineFieldRow>
          )}

          {(options.jsonData.version === InfluxVersion.InfluxQL || options.jsonData.version === InfluxVersion.Flux) && (
            <InlineFieldRow>
              <InlineField
                label="Min time interval"
                labelWidth={30}
                tooltip="A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example 1m if your data is written every minute."
              >
                <Input
                  className="width-15"
                  data-testid="influxdb-v2-config-time-interval"
                  onBlur={trackInfluxDBConfigV2AdvancedDbConnectionSettingsMinTimeClicked}
                  onChange={onUpdateDatasourceJsonDataOption(props, 'timeInterval')}
                  placeholder="10s"
                  value={options.jsonData.timeInterval || ''}
                />
              </InlineField>
            </InlineFieldRow>
          )}

          {options.jsonData.version === InfluxVersion.InfluxQL && (
            <InlineFieldRow>
              <InlineField
                label="Autocomplete Range"
                labelWidth={30}
                tooltip="This time range is used in the query editor's autocomplete to reduce the execution time of tag filter queries."
              >
                <Input
                  className="width-15"
                  data-testid="influxdb-v2-config-autocomplete-range"
                  onBlur={trackInfluxDBConfigV2AdvancedDbConnectionSettingsAutocompleteClicked}
                  onChange={onUpdateDatasourceJsonDataOption(props, 'showTagTime')}
                  placeholder="12h"
                  value={options.jsonData.showTagTime || ''}
                />
              </InlineField>
            </InlineFieldRow>
          )}

          <InlineFieldRow>
            <InlineField
              label="Max series"
              labelWidth={30}
              tooltip="Limit the number of series/tables that Grafana will process. Lower this number to prevent abuse, and increase it if you have lots of small time series and not all are shown. Defaults to 1000."
            >
              <Input
                className="width-15"
                data-testid="influxdb-v2-config-max-series"
                onBlur={trackInfluxDBConfigV2AdvancedDbConnectionSettingsMaxSeriesClicked}
                onChange={(e) => {
                  setMaxSeriesValue(e.currentTarget.value);
                  const val = parseInt(e.currentTarget.value, 10);
                  updateDatasourcePluginJsonDataOption(props, 'maxSeries', Number.isFinite(val) ? val : undefined);
                }}
                placeholder="1000"
                value={maxSeriesValue}
                type="number"
              />
            </InlineField>
          </InlineFieldRow>
        </>
      )}
    </>
  );
};
