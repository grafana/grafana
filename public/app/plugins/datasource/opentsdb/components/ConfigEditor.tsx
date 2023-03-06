import React from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataSourceHttpSettings, SecureSocksProxySettings } from '@grafana/ui';

import { OpenTsdbOptions } from '../types';

import { OpenTsdbDetails } from './OpenTsdbDetails';

export const ConfigEditor = (props: DataSourcePluginOptionsEditorProps<OpenTsdbOptions>) => {
  const { options, onOptionsChange } = props;

  return (
    <>
      <DataSourceHttpSettings
        defaultUrl="http://localhost:4242"
        dataSourceConfig={options}
        onChange={onOptionsChange}
      />
      {config.featureToggles.secureSocksDatasourceProxy && (
        <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
      )}
      <OpenTsdbDetails value={options} onChange={onOptionsChange} />
    </>
  );
};
