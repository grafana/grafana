import { uniqueId } from 'lodash';
import React from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOption,
  onUpdateDatasourceSecureJsonDataOption,
  updateDatasourcePluginResetOption,
} from '@grafana/data';
import { InlineFormLabel, LegacyForms } from '@grafana/ui';

import { InfluxOptions, InfluxSecureJsonData } from '../../../types';

const { Input, SecretFormField } = LegacyForms;

export type Props = DataSourcePluginOptionsEditorProps<InfluxOptions, InfluxSecureJsonData>;

export const InfluxFluxConfig = (props: Props) => {
  const {
    options: { jsonData, secureJsonData, secureJsonFields },
  } = props;
  const htmlPrefix = uniqueId('influxdb-flux-config');

  return (
    <>
      <div className="gf-form-inline">
        <div className="gf-form">
          <InlineFormLabel htmlFor={`${htmlPrefix}-org`} className="width-10">
            Organization
          </InlineFormLabel>
          <div className="width-10">
            <Input
              id={`${htmlPrefix}-org`}
              className="width-20"
              value={jsonData.organization || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'organization')}
            />
          </div>
        </div>
      </div>
      <div className="gf-form-inline">
        <div className="gf-form">
          <SecretFormField
            isConfigured={Boolean(secureJsonFields && secureJsonFields.token)}
            value={secureJsonData?.token || ''}
            label="Token"
            aria-label="Token"
            labelWidth={10}
            inputWidth={20}
            onReset={() => updateDatasourcePluginResetOption(props, 'token')}
            onChange={onUpdateDatasourceSecureJsonDataOption(props, 'token')}
          />
        </div>
      </div>
      <div className="gf-form-inline">
        <div className="gf-form">
          <InlineFormLabel className="width-10">Default Bucket</InlineFormLabel>
          <div className="width-10">
            <Input
              className="width-20"
              placeholder="default bucket"
              value={jsonData.defaultBucket || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'defaultBucket')}
            />
          </div>
        </div>
      </div>

      <div className="gf-form-inline">
        <div className="gf-form">
          <InlineFormLabel
            className="width-10"
            tooltip="A lower limit for the auto group by time interval. Recommended to be set to write frequency,
				for example 1m if your data is written every minute."
          >
            Min time interval
          </InlineFormLabel>
          <div className="width-10">
            <Input
              className="width-20"
              placeholder="10s"
              value={jsonData.timeInterval || ''}
              onChange={onUpdateDatasourceJsonDataOption(props, 'timeInterval')}
            />
          </div>
        </div>
      </div>
    </>
  );
};
