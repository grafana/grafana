import { uniqueId } from 'lodash';
import React from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { InlineField, InlineFieldRow, Input, SecretInput } from '@grafana/ui';

import { InfluxOptions, InfluxSecureJsonData } from '../../../types';

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions, InfluxSecureJsonData>;

export const InfluxFluxConfig = (props: Props) => {
  const {
    options: { jsonData, secureJsonData, secureJsonFields },
  } = props;
  const htmlPrefix = uniqueId('influxdb-flux-config');

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Organization" labelWidth={20}>
          <Input
            id={`${htmlPrefix}-org`}
            width={40}
            value={jsonData.organization || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'organization')}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField label="Token" labelWidth={20}>
          <SecretInput
            id="token-input"
            isConfigured={Boolean(secureJsonFields && secureJsonFields.token)}
            value={secureJsonData?.token || ''}
            width={40}
            onReset={() => updateDatasourcePluginResetOption(props, 'token')}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'token')}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField label="Default bucket" labelWidth={20}>
          <Input
            id="default-bucket"
            width={40}
            placeholder="default bucket"
            value={jsonData.defaultBucket || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'defaultBucket')}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField
          label="Min time interval"
          tooltip="A lower limit for the auto group by time interval. Recommended to be set to write frequency,
				for example 1m if your data is written every minute."
          labelWidth={20}
        >
          <Input
            id="time-interval"
            width={40}
            placeholder="10s"
            value={jsonData.timeInterval || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'timeInterval')}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
