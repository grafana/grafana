import { cx } from '@emotion/css';
import { useState } from 'react';

import { DataSourcePluginOptionsEditorProps, onUpdateDatasourceJsonDataOptionSelect } from '@grafana/data';
import { InlineFieldRow, InlineField, Combobox, InlineSwitch, Input, Space, useStyles2 } from '@grafana/ui';

import { InfluxOptions, InfluxVersion } from '../../../types';

import { getInlineLabelStyles, HTTP_MODES } from './constants';
import {
  trackInfluxDBConfigV2AdvancedDbConnectionSettingsHTTPMethodClicked,
  trackInfluxDBConfigV2AdvancedDbConnectionSettingsInsecureConnectClicked,
  trackInfluxDBConfigV2AdvancedDbConnectionSettingsMinTimeClicked,
  trackInfluxDBConfigV2AdvancedDbConnectionSettingsToggleClicked,
} from './tracking';

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

export const AdvancedDbConnectionSettings = (props: Props) => {
  const { options, onOptionsChange } = props;
  const styles = useStyles2(getInlineLabelStyles);

  const [advancedDbConnectionSettingsIsOpen, setAdvancedDbConnectionSettingsIsOpen] = useState(
    () => !!options.jsonData.timeInterval || !!options.jsonData.insecureGrpc
  );

  return (
    <>
      <Space v={2} />
      <InlineField label={<div className={cx(styles.label)}>Advanced Database Settings</div>} labelWidth={40}>
        <InlineSwitch
          value={advancedDbConnectionSettingsIsOpen}
          onChange={() => setAdvancedDbConnectionSettingsIsOpen(!advancedDbConnectionSettingsIsOpen)}
          onBlur={trackInfluxDBConfigV2AdvancedDbConnectionSettingsToggleClicked}
        />
      </InlineField>
      {advancedDbConnectionSettingsIsOpen && (
        <>
          {options.jsonData.version === InfluxVersion.InfluxQL && (
            <>
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
                  />
                </InlineField>
              </InlineFieldRow>
            </>
          )}
          {options.jsonData.version === InfluxVersion.SQL && (
            <>
              <InlineFieldRow>
                <InlineField label="Insecure Connection" labelWidth={30}>
                  <InlineSwitch
                    value={options.jsonData.insecureGrpc ?? false}
                    onChange={(event) => {
                      onOptionsChange({
                        ...options,
                        jsonData: {
                          ...options.jsonData,
                          insecureGrpc: event.currentTarget.checked,
                        },
                      });
                    }}
                    onBlur={trackInfluxDBConfigV2AdvancedDbConnectionSettingsInsecureConnectClicked}
                  />
                </InlineField>
              </InlineFieldRow>
            </>
          )}
          {(options.jsonData.version === InfluxVersion.InfluxQL || options.jsonData.version === InfluxVersion.Flux) && (
            <>
              <InlineFieldRow>
                <InlineField
                  label="Min time interval"
                  labelWidth={30}
                  tooltip="A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example 1m if your data is written every minute."
                >
                  <Input
                    className="width-15"
                    placeholder="10s"
                    value={options.jsonData.timeInterval || ''}
                    onChange={(e) =>
                      onOptionsChange({
                        ...options,
                        jsonData: { ...options.jsonData, timeInterval: e.currentTarget.value },
                      })
                    }
                    onBlur={trackInfluxDBConfigV2AdvancedDbConnectionSettingsMinTimeClicked}
                  />
                </InlineField>
              </InlineFieldRow>
            </>
          )}
        </>
      )}
    </>
  );
};
