import { DataSourcePluginOptionsEditorProps, onUpdateDatasourceJsonDataOptionSelect } from '@grafana/data';
import { Alert, InlineField, Select } from '@grafana/ui';
import React, { PureComponent } from 'react';

import { AuthType, authTypes, CloudMonitoringOptions, CloudMonitoringSecureJsonData } from '../../types';
import { JWTConfig } from './JWTConfig';

export type Props = DataSourcePluginOptionsEditorProps<CloudMonitoringOptions, CloudMonitoringSecureJsonData>;

export class ConfigEditor extends PureComponent<Props> {
  render() {
    const { options, onOptionsChange } = this.props;
    const { secureJsonFields, jsonData } = options;

    if (!jsonData.hasOwnProperty('authenticationType')) {
      jsonData.authenticationType = AuthType.JWT;
    }

    return (
      <>
        <h3 className="page-heading">Authentication</h3>
        <div>
          <InlineField label="Type" labelWidth={20} htmlFor="cloud-monitoring-type">
            <Select
              inputId="cloud-monitoring-type"
              menuShouldPortal
              width={40}
              value={authTypes.find((x) => x.value === jsonData.authenticationType) || authTypes[0]}
              options={authTypes}
              defaultValue={jsonData.authenticationType}
              onChange={onUpdateDatasourceJsonDataOptionSelect(this.props, 'authenticationType')}
            />
          </InlineField>
          {jsonData.authenticationType === AuthType.JWT && (
            <JWTConfig
              isConfigured={secureJsonFields && !!secureJsonFields.jwt}
              onChange={({ private_key, client_email, project_id, token_uri }) => {
                onOptionsChange({
                  ...options,
                  secureJsonData: {
                    ...options.secureJsonData,
                    privateKey: private_key,
                  },
                  jsonData: {
                    ...options.jsonData,
                    defaultProject: project_id,
                    clientEmail: client_email,
                    tokenUri: token_uri,
                  },
                });
              }}
            ></JWTConfig>
          )}
          <div className="grafana-info-box" style={{ marginTop: '16px' }}>
            <p>
              Don’t know how to get a service account key file or create a service account? Read more{' '}
              <a
                className="external-link"
                target="_blank"
                rel="noopener noreferrer"
                href="https://grafana.com/docs/grafana/latest/datasources/google-cloud-monitoring/"
              >
                in the documentation.
              </a>
            </p>
          </div>
        </div>
        {jsonData.authenticationType === AuthType.GCE && (
          <Alert title="" severity="info">
            Verify GCE default service account by clicking Save & Test
          </Alert>
        )}
      </>
    );
  }
}
