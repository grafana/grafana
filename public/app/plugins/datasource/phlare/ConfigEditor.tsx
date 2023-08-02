import React from 'react';
import { useAsyncFn, useDebounce } from 'react-use';

import { DataSourcePluginOptionsEditorProps, SelectableValue } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Alert, DataSourceHttpSettings, EventsWithValidation, LegacyForms, regexValidation } from '@grafana/ui';
import { config } from 'app/core/config';

import { PhlareDataSource } from './datasource';
import { BackendType, PhlareDataSourceOptions } from './types';

interface Props extends DataSourcePluginOptionsEditorProps<PhlareDataSourceOptions> {}

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;
  const [mismatchedBackendType, setMismatchedBackendType] = React.useState<BackendType | undefined>();

  const dataSourceSrv = getDataSourceSrv();

  const [, getBackendType] = useAsyncFn(async () => {
    if (!options.url) {
      return;
    }
    const ds = await dataSourceSrv.get({ type: options.type, uid: options.uid });
    if (!(ds instanceof PhlareDataSource)) {
      // Should not happen, makes TS happy
      throw new Error('Datasource is not a PhlareDataSource');
    }

    const { backendType } = await ds.getBackendType(options.url);
    if (backendType === 'unknown') {
      setMismatchedBackendType(undefined);
      return;
    }

    // If user already has something selected don't overwrite but show warning.
    if (options.jsonData.backendType) {
      if (backendType !== options.jsonData.backendType) {
        setMismatchedBackendType(backendType);
      } else {
        setMismatchedBackendType(undefined);
      }
      return;
    }

    onOptionsChange({ ...options, jsonData: { ...options.jsonData, backendType } });
  }, [options]);

  useDebounce(getBackendType, 500, [options]);

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

        <div className="gf-form-inline">
          <div className="gf-form">
            <LegacyForms.FormField
              label="Backend type"
              labelWidth={13}
              inputEl={
                <LegacyForms.Select<BackendType>
                  allowCustomValue={false}
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
        {mismatchedBackendType && (
          <Alert
            title={`"${options.jsonData.backendType}" option is selected but it seems like you are using "${mismatchedBackendType}" backend.`}
            severity="warning"
          />
        )}
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
