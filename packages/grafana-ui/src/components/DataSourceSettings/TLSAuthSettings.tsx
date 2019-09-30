import React from 'react';
import { HttpSettingsBaseProps } from './types';
import { KeyValue } from '@grafana/data';

// TODO: Refactor forms below to a reusable Cert component
export const TLSAuthSettings: React.FC<HttpSettingsBaseProps> = ({ dataSourceConfig, onChange }) => {
  console.log();
  const hasTLSCACert = dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.tlsCACert;
  const hasTLSClientCert = dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.tlsClientCert;
  // @ts-ignre
  const hasTLSClientKey = dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.tlsClientKey;

  const onResetClickFactory = (field: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const newSecureJsonFields: KeyValue<boolean> = { ...dataSourceConfig.secureJsonFields };
    newSecureJsonFields[field] = false;
    onChange({
      ...dataSourceConfig,
      secureJsonFields: newSecureJsonFields,
    });
  };

  const onCertificateChangeFactory = (field: string) => (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const newSecureJsonData = { ...dataSourceConfig.jsonData };
    newSecureJsonData[field] = event.currentTarget.value;

    onChange({
      ...dataSourceConfig,
      secureJsonData: newSecureJsonData,
    });
  };

  return (
    <div className="gf-form-group">
      <div className="gf-form">
        <h6>TLS Auth Details</h6>
        <h6>TODO: add missing info popover</h6>
      </div>
      <div>
        {dataSourceConfig.jsonData.tlsAuthWithCACert && (
          <div className="gf-form-inline">
            <div className="gf-form gf-form--v-stretch">
              <label className="gf-form-label width-7">CA Cert</label>
            </div>
            {!hasTLSCACert && (
              <div className="gf-form gf-form--grow" ng-if="!current.secureJsonFields.tlsCACert">
                <textarea
                  rows={7}
                  className="gf-form-input gf-form-textarea"
                  onChange={onCertificateChangeFactory('tlsCACert')}
                  ng-model="current.secureJsonData.tlsCACert"
                  placeholder="Begins with -----BEGIN CERTIFICATE-----"
                />
              </div>
            )}

            {hasTLSCACert && (
              <div className="gf-form">
                <input type="text" className="gf-form-input max-width-12" disabled value="configured" />
                <a className="btn btn-secondary gf-form-btn" onClick={onResetClickFactory('tlsCACert')}>
                  reset
                </a>
              </div>
            )}
          </div>
        )}

        {dataSourceConfig.jsonData.tlsAuth && (
          <>
            <div className="gf-form-inline">
              <div className="gf-form gf-form--v-stretch">
                <label className="gf-form-label width-7">Client Cert</label>
              </div>
              {!hasTLSClientCert && (
                <div className="gf-form gf-form--grow">
                  <textarea
                    rows={7}
                    className="gf-form-input gf-form-textarea"
                    onChange={onCertificateChangeFactory('tlsClientCert')}
                    placeholder="Begins with -----BEGIN CERTIFICATE-----"
                    required
                  />
                </div>
              )}
              {hasTLSClientCert && (
                <div className="gf-form">
                  <input type="text" className="gf-form-input max-width-12" disabled value="configured" />
                  <a className="btn btn-secondary gf-form-btn" onClick={onResetClickFactory('tlsClientCert')}>
                    reset
                  </a>
                </div>
              )}
            </div>

            <div className="gf-form-inline">
              <div className="gf-form gf-form--v-stretch">
                <label className="gf-form-label width-7">Client Key</label>
              </div>
              {!hasTLSClientKey && (
                <div className="gf-form gf-form--grow">
                  <textarea
                    rows={7}
                    className="gf-form-input gf-form-textarea"
                    onChange={onCertificateChangeFactory('tlsClientKey')}
                    placeholder="Begins with -----BEGIN RSA PRIVATE KEY-----"
                    required
                  />
                </div>
              )}
              {hasTLSClientKey && (
                <div className="gf-form">
                  <input type="text" className="gf-form-input max-width-12" disabled value="configured" />
                  <a className="btn btn-secondary gf-form-btn" onClick={onResetClickFactory('tlsClientKey')}>
                    reset
                  </a>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
