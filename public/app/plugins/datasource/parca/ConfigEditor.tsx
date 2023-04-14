import React from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { DataSourceHttpSettings, SecureSocksProxySettings } from '@grafana/ui';
import { config } from 'app/core/config';

import { ParcaDataSourceOptions } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<ParcaDataSourceOptions> {}

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;

  return (
    <>
      <DataSourceHttpSettings
        defaultUrl={'http://localhost:7070'}
        dataSourceConfig={options}
        showAccessOptions={false}
        onChange={onOptionsChange}
      />
      {config.featureToggles.secureSocksDatasourceProxy && (
        <SecureSocksProxySettings options={options} onOptionsChange={onOptionsChange} />
      )}
    </>
  );
};
