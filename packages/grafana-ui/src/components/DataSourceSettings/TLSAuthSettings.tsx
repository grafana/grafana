import React from 'react';
import { KeyValue } from '@grafana/data';
import { css, cx } from 'emotion';
import { Tooltip } from '..';
import { CertificationTextArea } from './CertificationTextArea';
import { HttpSettingsBaseProps } from './types';

// TODO: Refactor forms below to a reusable Cert component
export const TLSAuthSettings: React.FC<HttpSettingsBaseProps> = ({ dataSourceConfig, onChange }) => {
  const hasTLSCACert = dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.tlsCACert;
  const hasTLSClientCert = dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.tlsClientCert;
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
      <div
        className={cx(
          'gf-form',
          css`
            align-items: baseline;
          `
        )}
      >
        <h6>TLS Auth Details</h6>
        <Tooltip
          placement="right-end"
          content="TLS Certs are encrypted and stored in the Grafana database."
          theme="info"
        >
          <div className="gf-form-help-icon gf-form-help-icon--right-normal">
            <i className="fa fa-info-circle" />
          </div>
        </Tooltip>
      </div>
      <div>
        {dataSourceConfig.jsonData.tlsAuthWithCACert && (
          <div className="gf-form-inline">
            <div className="gf-form gf-form--v-stretch">
              <label className="gf-form-label width-7">CA Cert</label>
            </div>
            {!hasTLSCACert && (
              <div className="gf-form gf-form--grow">
                <CertificationTextArea
                  value={dataSourceConfig.secureJsonData.tlsCACert}
                  onChange={onCertificateChangeFactory('tlsCACert')}
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
                  <CertificationTextArea
                    value={dataSourceConfig.secureJsonData.tlsClientCert}
                    onChange={onCertificateChangeFactory('tlsClientCert')}
                    placeholder="Begins with -----BEGIN CERTIFICATE-----"
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
                  <CertificationTextArea
                    value={dataSourceConfig.secureJsonData.tlsClientKey}
                    placeholder="Begins with -----BEGIN RSA PRIVATE KEY-----"
                    onChange={onCertificateChangeFactory('tlsClientKey')}
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
