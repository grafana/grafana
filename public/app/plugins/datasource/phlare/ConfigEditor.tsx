import React from 'react';
import { useAsync } from 'react-use';

import { DataSourcePluginOptionsEditorProps, SelectableValue } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataSourceHttpSettings, EventsWithValidation, LegacyForms, regexValidation } from '@grafana/ui';
import { config } from 'app/core/config';

import { PhlareDataSource } from './datasource';
import { BackendType, PhlareDataSourceOptions } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<PhlareDataSourceOptions> {}

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;

  const dataSourceSrv = getDataSourceSrv();

  const { value: datasource } = useAsync(async () => {
    // If backend type is already set don't try to autodetect.
    // TODO: maybe we should check anyway and show a warning if it does not match?
    if (options.jsonData.backendType) {
      return;
    }
    return (await dataSourceSrv.get({ type: options.type, uid: options.uid })) as PhlareDataSource;
  }, [dataSourceSrv, options]);

  useAsync(async () => {
    if (!datasource || !options.url) {
      return;
    }
    const { backendType } = await datasource.getBackendType();
    onOptionsChange({ ...options, jsonData: { ...options.jsonData, backendType } });
  }, [datasource]);

  return (
    <>
      <DataSourceHttpSettings
        defaultUrl={'http://localhost:4100'}
        dataSourceConfig={options}
        showAccessOptions={false}
        onChange={onOptionsChange}
        secureSocksDSProxyEnabled={config.secureSocksDSProxyEnabled}
      />

      <h3 className="page-heading">Querying</h3>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <LegacyForms.FormField
              label="Minimal step"
              labelWidth={13}
              inputEl={
                <LegacyForms.Input
                  className="width-6"
                  value={options.jsonData.minStep}
                  spellCheck={false}
                  placeholder="15s"
                  onChange={(event) => {
                    onOptionsChange({
                      ...options,
                      jsonData: {
                        ...options.jsonData,
                        minStep: event.currentTarget.value,
                      },
                    });
                  }}
                  validationEvents={{
                    [EventsWithValidation.onBlur]: [
                      regexValidation(
                        /^$|^\d+(ms|[Mwdhmsy])$/,
                        'Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s'
                      ),
                    ],
                  }}
                />
              }
              tooltip="Minimal step used for metric query. Should be the same or higher as the scrape interval setting in the Phlare database."
            />
          </div>
        </div>
      </div>

      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <LegacyForms.FormField
              label="Backend type"
              labelWidth={13}
              inputEl={
                <LegacyForms.Select<BackendType>
                  value={options.jsonData.backendType ? backendTypeOptions[options.jsonData.backendType] : undefined}
                  options={Object.values(backendTypeOptions)}
                  onChange={(option) => {
                    onOptionsChange({
                      ...options,
                      jsonData: {
                        ...options.jsonData,
                        backendType: option.value,
                      },
                    });
                  }}
                />
              }
              tooltip="Select what type of backend you use. This datasource supports both Phlare and Pyroscope backends."
            />
          </div>
        </div>
      </div>
    </>
  );
};

const backendTypeOptions: Record<BackendType, SelectableValue<BackendType>> = {
  phlare: {
    label: 'Phlare',
    value: 'phlare',
  },
  pyroscope: {
    label: 'Pyroscope',
    value: 'pyroscope',
  },
};
