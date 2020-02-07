import React from 'react';
import { KeyValue } from '@grafana/data';
import { css, cx } from 'emotion';
import { Tooltip } from '../Tooltip/Tooltip';
import { CertificationKey } from './CertificationKey';
import { HttpSettingsBaseProps } from './types';

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
    const newSecureJsonData = { ...dataSourceConfig.secureJsonData };
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
          <CertificationKey
            hasCert={!!hasTLSCACert}
            onChange={onCertificateChangeFactory('tlsCACert')}
            placeholder="Begins with -----BEGIN CERTIFICATE-----"
            label="CA Cert"
            onClick={onResetClickFactory('tlsCACert')}
          />
        )}

        {dataSourceConfig.jsonData.tlsAuth && (
          <>
            <CertificationKey
              hasCert={!!hasTLSClientCert}
              label="Client Cert"
              onChange={onCertificateChangeFactory('tlsClientCert')}
              placeholder="Begins with -----BEGIN CERTIFICATE-----"
              onClick={onResetClickFactory('tlsClientCert')}
            />

            <CertificationKey
              hasCert={!!hasTLSClientKey}
              label="Client Key"
              placeholder="Begins with -----BEGIN RSA PRIVATE KEY-----"
              onChange={onCertificateChangeFactory('tlsClientKey')}
              onClick={onResetClickFactory('tlsClientKey')}
            />
          </>
        )}
      </div>
    </div>
  );
};
