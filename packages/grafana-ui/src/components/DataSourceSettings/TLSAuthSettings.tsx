import { css, cx } from '@emotion/css';
import * as React from 'react';

import { KeyValue } from '@grafana/data';

import { t, Trans } from '../../utils/i18n';
import { FormField } from '../FormField/FormField';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';

import { CertificationKey } from './CertificationKey';
import { HttpSettingsBaseProps } from './types';

export const TLSAuthSettings = ({ dataSourceConfig, onChange }: HttpSettingsBaseProps) => {
  const hasTLSCACert = dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.tlsCACert;
  const hasTLSClientCert = dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.tlsClientCert;
  const hasTLSClientKey = dataSourceConfig.secureJsonFields && dataSourceConfig.secureJsonFields.tlsClientKey;
  const hasServerName = dataSourceConfig.jsonData && dataSourceConfig.jsonData.serverName;

  const onResetClickFactory = (field: string) => (event: React.MouseEvent<HTMLButtonElement>) => {
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

  const onServerNameLabelChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const newJsonData = {
      ...dataSourceConfig.jsonData,
      serverName: event.currentTarget.value,
    };

    onChange({
      ...dataSourceConfig,
      jsonData: newJsonData,
    });
  };

  const certificateBeginsWith = '-----BEGIN CERTIFICATE-----';
  const privateKeyBeginsWith = '-----BEGIN RSA PRIVATE KEY-----';

  return (
    <div className="gf-form-group">
      <div
        className={cx(
          'gf-form',
          css({
            alignItems: 'baseline',
          })
        )}
      >
        <h6>
          <Trans i18nKey="grafana-ui.data-source-settings.tls-heading">TLS/SSL Auth Details</Trans>
        </h6>
        <Tooltip
          placement="right-end"
          content={t(
            'grafana-ui.data-source-settings.tls-tooltip',
            'TLS/SSL Certs are encrypted and stored in the Grafana database.'
          )}
          theme="info"
        >
          <Icon name="info-circle" size="xs" style={{ marginLeft: '10px' }} />
        </Tooltip>
      </div>
      <div>
        {dataSourceConfig.jsonData.tlsAuthWithCACert && (
          <CertificationKey
            hasCert={!!hasTLSCACert}
            onChange={onCertificateChangeFactory('tlsCACert')}
            placeholder={t(
              'grafana-ui.data-source-settings.tls-certification-placeholder',
              'Begins with {{certificateBeginsWith}}',
              { certificateBeginsWith }
            )}
            label={t('grafana-ui.data-source-settings.tls-certification-label', 'CA Cert')}
            onClick={onResetClickFactory('tlsCACert')}
          />
        )}

        {dataSourceConfig.jsonData.tlsAuth && (
          <>
            <div className="gf-form">
              <FormField
                label={t('grafana-ui.data-source-settings.tls-server-name-label', 'ServerName')}
                labelWidth={7}
                inputWidth={30}
                // eslint-disable-next-line @grafana/no-untranslated-strings
                placeholder="domain.example.com"
                value={hasServerName && dataSourceConfig.jsonData.serverName}
                onChange={onServerNameLabelChange}
              />
            </div>
            <CertificationKey
              hasCert={!!hasTLSClientCert}
              label={t('grafana-ui.data-source-settings.tls-client-certification-label', 'Client Cert')}
              onChange={onCertificateChangeFactory('tlsClientCert')}
              placeholder={t(
                'grafana-ui.data-source-settings.tls-certification-placeholder',
                'Begins with {{certificateBeginsWith}}',
                { certificateBeginsWith }
              )}
              onClick={onResetClickFactory('tlsClientCert')}
            />

            <CertificationKey
              hasCert={!!hasTLSClientKey}
              label={t('grafana-ui.data-source-settings.tls-client-key-label', 'Client Key')}
              placeholder={t(
                'grafana-ui.data-source-settings.tls-client-key-placeholder',
                'Begins with {{privateKeyBeginsWith}}',
                { privateKeyBeginsWith }
              )}
              onChange={onCertificateChangeFactory('tlsClientKey')}
              onClick={onResetClickFactory('tlsClientKey')}
            />
          </>
        )}
      </div>
    </div>
  );
};
