import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { InlineFieldRow, InlineField, Input, SecretInput } from '@grafana/ui';

import { InfluxOptions } from '../../../types';

import {
  trackInfluxDBConfigV2FluxDBDetailsDefaultBucketInputField,
  trackInfluxDBConfigV2FluxDBDetailsOrgInputField,
  trackInfluxDBConfigV2FluxDBDetailsTokenInputField,
} from './tracking';

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions>;

export const InfluxFluxDBConnection = ({ options, onOptionsChange }: Props) => (
  <>
    <InlineFieldRow>
      <InlineField label="Organization" labelWidth={30} grow>
        <Input
          value={options.jsonData.organization || ''}
          onChange={(e) =>
            onOptionsChange({
              ...options,
              jsonData: { ...options.jsonData, organization: e.currentTarget.value },
            })
          }
          onBlur={trackInfluxDBConfigV2FluxDBDetailsOrgInputField}
        />
      </InlineField>
    </InlineFieldRow>
    <InlineFieldRow>
      <InlineField labelWidth={30} label="Default Bucket" grow>
        <Input
          placeholder="default bucket"
          value={options.jsonData.defaultBucket || ''}
          onChange={(e) =>
            onOptionsChange({
              ...options,
              jsonData: { ...options.jsonData, defaultBucket: e.currentTarget.value },
            })
          }
          onBlur={trackInfluxDBConfigV2FluxDBDetailsDefaultBucketInputField}
        />
      </InlineField>
    </InlineFieldRow>
    <InlineFieldRow>
      <InlineField labelWidth={30} label="Token" grow>
        <SecretInput
          isConfigured={options.secureJsonFields.token || false}
          onChange={(e) =>
            onOptionsChange({
              ...options,
              secureJsonData: {
                ...options.secureJsonData,
                token: e.currentTarget.value,
              },
            })
          }
          onReset={() => {
            onOptionsChange({
              ...options,
              secureJsonData: {
                ...options.secureJsonData,
                token: '',
              },
              secureJsonFields: {
                ...options.secureJsonFields,
                token: false,
              },
            });
          }}
          onBlur={() => {
            onOptionsChange({
              ...options,
              secureJsonFields: {
                ...options.secureJsonFields,
                token: true,
              },
            });
            trackInfluxDBConfigV2FluxDBDetailsTokenInputField();
          }}
        />
      </InlineField>
    </InlineFieldRow>
  </>
);
