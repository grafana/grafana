import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { convertLegacyAuthProps } from '@grafana/plugin-ui';
import { Box, CollapsableSection, CertificationKey, Text, useStyles2, Checkbox, Stack, Badge } from '@grafana/ui';

import { CONFIG_SECTION_HEADERS, CONTAINER_MIN_WIDTH } from './constants';
import { Props } from './types';

type TLSOptions = {
  tlsClientAuth: boolean;
  tlsAuthWithCACert: boolean;
  tlsSkipVerify: boolean;
};

export const TLSSSLSettingsSection = (props: Props) => {
  const { options, onOptionsChange } = props;
  const styles = useStyles2(getStyles);

  const authProps = useMemo(
    () =>
      convertLegacyAuthProps({
        config: options,
        onChange: onOptionsChange,
      }),
    [options, onOptionsChange]
  );

  const [tlsOptions, setTlsOptions] = useState<TLSOptions>({
    tlsClientAuth: authProps.TLS?.TLSClientAuth.enabled ?? false,
    tlsAuthWithCACert: authProps.TLS?.selfSignedCertificate.enabled ?? false,
    tlsSkipVerify: authProps.TLS?.skipTLSVerification.enabled ?? false,
  });

  const onTLSSettingsChange = (key: 'tlsSkipVerify' | 'tlsClientAuth' | 'tlsAuthWithCACert', value: boolean) => {
    setTlsOptions((prev) => ({ ...prev, [key]: value }));
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        [key]: value,
      },
    });
  };

  return (
    <Box
      borderStyle="solid"
      borderColor="weak"
      padding={2}
      marginBottom={4}
      id={`${CONFIG_SECTION_HEADERS[2].id}`}
      minWidth={CONTAINER_MIN_WIDTH}
    >
      <CollapsableSection
        label={
          <>
            <Text variant="h3">3. {CONFIG_SECTION_HEADERS[2].label}</Text>
            <Badge text="optional" color="blue" className={styles.badge} />
          </>
        }
        isOpen={!!(tlsOptions.tlsSkipVerify || tlsOptions.tlsClientAuth || tlsOptions.tlsAuthWithCACert)}
      >
        <Text variant="body" color="secondary">
          TLS/SSL certificates are used to prove identity and encrypt traffic between Grafana and InfluxDB.
        </Text>
        <div className={styles.contentSection}>
          <Stack
            direction={tlsOptions.tlsClientAuth || tlsOptions.tlsAuthWithCACert ? 'column' : 'row'}
            gap={3}
            alignItems="flex-start"
          >
            <Checkbox
              className={css({ margin: 0 })}
              label="Skip TLS Verify"
              value={tlsOptions.tlsSkipVerify || false}
              onChange={(e) => {
                onTLSSettingsChange('tlsSkipVerify', e.currentTarget.checked);
              }}
            />
            <Checkbox
              className={css({ margin: 0 })}
              label="TLS Client Auth"
              value={tlsOptions.tlsClientAuth || false}
              onChange={(e) => {
                onTLSSettingsChange('tlsClientAuth', e.currentTarget.checked);
              }}
            />
            {tlsOptions.tlsClientAuth && (
              <div className={styles.certsSection}>
                <CertificationKey
                  label="Client Cert"
                  placeholder="Begins with -----BEGIN CERTIFICATE-----"
                  onChange={(e) => authProps.TLS?.TLSClientAuth.onClientCertificateChange(e.currentTarget.value)}
                  hasCert={!!authProps.TLS?.TLSClientAuth.clientCertificateConfigured}
                  onClick={() => authProps.TLS?.TLSClientAuth.onClientCertificateReset()}
                />
                <CertificationKey
                  label="Client Key"
                  placeholder="Begins with -----BEGIN RSA PRIVATE KEY-----"
                  onChange={(e) => authProps.TLS?.TLSClientAuth.onClientKeyChange(e.currentTarget.value)}
                  hasCert={!!authProps.TLS?.TLSClientAuth.clientKeyConfigured}
                  onClick={() => authProps.TLS?.TLSClientAuth.onClientKeyReset()}
                />
              </div>
            )}
            <Checkbox
              label="With CA Cert"
              value={tlsOptions.tlsAuthWithCACert || false}
              onChange={(e) => {
                onTLSSettingsChange('tlsAuthWithCACert', e.currentTarget.checked);
              }}
            />
            <div className={styles.certsSection}>
              {tlsOptions.tlsAuthWithCACert && (
                <CertificationKey
                  label="CA Cert"
                  placeholder="Begins with -----BEGIN CERTIFICATE-----"
                  onChange={(e) => authProps.TLS?.selfSignedCertificate.onCertificateChange(e.currentTarget.value)}
                  hasCert={!!authProps.TLS?.selfSignedCertificate.certificateConfigured}
                  onClick={() => authProps.TLS?.selfSignedCertificate.onCertificateReset()}
                />
              )}
            </div>
          </Stack>
        </div>
      </CollapsableSection>
    </Box>
  );
};

const getStyles = () => ({
  contentSection: css({
    marginTop: '30px',
  }),
  optionsRow: css({
    display: 'flex',
    gap: '50px',
  }),
  certsSection: css({
    marginTop: '10px',
  }),
  badge: css({
    marginLeft: 'auto',
  }),
});
