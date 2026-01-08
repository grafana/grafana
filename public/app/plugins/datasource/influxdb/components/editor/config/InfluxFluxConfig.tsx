import { uniqueId } from 'lodash';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { InlineField, InlineFieldRow, Input, SecretInput } from '@grafana/ui';

import { InfluxOptions, InfluxSecureJsonData } from '../../../types';

import { WIDTH_SHORT } from './constants';
import {
  trackInfluxDBConfigV1FluxDefaultBucketInputField,
  trackInfluxDBConfigV1FluxOrgInputField,
  trackInfluxDBConfigV1FluxTokenInputField,
} from './trackingv1';

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions, InfluxSecureJsonData>;

export const InfluxFluxConfig = (props: Props) => {
  const {
    options: { jsonData, secureJsonData, secureJsonFields },
  } = props;
  const htmlPrefix = uniqueId('influxdb-flux-config');

  return (
    <>
      <InlineFieldRow>
        <InlineField labelWidth={WIDTH_SHORT} label="Organization" htmlFor={`${htmlPrefix}-org`}>
          <Input
            id={`${htmlPrefix}-org`}
            className="width-20"
            value={jsonData.organization || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'organization')}
            onBlur={trackInfluxDBConfigV1FluxOrgInputField}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField labelWidth={WIDTH_SHORT} label="Token">
          <SecretInput
            isConfigured={Boolean(secureJsonFields && secureJsonFields.token)}
            value={secureJsonData?.token || ''}
            label="Token"
            aria-label="Token"
            className="width-20"
            onReset={() => updateDatasourcePluginResetOption(props, 'token')}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'token')}
            onBlur={trackInfluxDBConfigV1FluxTokenInputField}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField labelWidth={WIDTH_SHORT} label="Default Bucket">
          <Input
            className="width-20"
            placeholder="default bucket"
            value={jsonData.defaultBucket || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'defaultBucket')}
            onBlur={trackInfluxDBConfigV1FluxDefaultBucketInputField}
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField
          labelWidth={WIDTH_SHORT}
          label="Min time interval"
          tooltip="A lower limit for the auto group by time interval. Recommended to be set to write frequency,
				for example 1m if your data is written every minute."
        >
          <Input
            className="width-20"
            placeholder="10s"
            value={jsonData.timeInterval || ''}
            onChange={onUpdateDatasourceJsonDataOption(props, 'timeInterval')}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
