import React, { PureComponent } from 'react';
import { Select, FieldSet, InlineField, Alert } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, onUpdateDatasourceJsonDataOptionSelect } from '@grafana/data';
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
        <div className="gf-form-group">
          <div className="grafana-info-box">
            <h4>Google Cloud Monitoring Authentication</h4>
            <p>
              There are two ways to authenticate the Google Cloud Monitoring plugin - either by uploading a Service
              Account key file or by automatically retrieving credentials from the Google metadata server. The latter
              option is only available when running Grafana on a GCE virtual machine.
            </p>

            <h5>Uploading a Service Account Key File</h5>
            <p>
              There are two ways to authenticate the Google Cloud Monitoring plugin. You can upload a Service Account
              key file or automatically retrieve credentials from the Google metadata server. The latter option is only
              available when running Grafana on a GCE virtual machine.
            </p>
            <p>
              The <strong>Monitoring Viewer</strong> role provides all the permissions that Grafana needs. The following
              API needs to be enabled on GCP for the data source to work:{' '}
              <a
                className="external-link"
                target="_blank"
                rel="noopener noreferrer"
                href="https://console.cloud.google.com/apis/library/monitoring.googleapis.com"
              >
                Monitoring API
              </a>
            </p>

            <h5>GCE Default Service Account</h5>
            <p>
              If Grafana is running on a Google Compute Engine (GCE) virtual machine, it is possible for Grafana to
              automatically retrieve the default project id and authentication token from the metadata server. In order
              for this to work, you need to make sure that you have a service account that is setup as the default
              account for the virtual machine and that the service account has been given read access to the Google
              Cloud Monitoring Monitoring API.
            </p>

            <p>
              Detailed instructions on how to create a Service Account can be found{' '}
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

        <FieldSet>
          <InlineField label="Authentication type" labelWidth={20}>
            <Select
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
        </FieldSet>
        {jsonData.authenticationType === AuthType.GCE && (
          <Alert title="" severity="info">
            Verify GCE default service account by clicking Save & Test
          </Alert>
        )}
      </>
    );
  }
}
