import { css } from '@emotion/css';
import { useState, useCallback, useId, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';

import { useTheme2 } from '../../themes/ThemeContext';
import { Alert } from '../Alert/Alert';
import { Button } from '../Button/Button';
import { Field } from '../Forms/Field';
import { InlineField } from '../Forms/InlineField';
import { RadioButtonGroup } from '../Forms/RadioButtonGroup/RadioButtonGroup';
import { Icon } from '../Icon/Icon';
import { Input } from '../Input/Input';
import { Stack } from '../Layout/Stack/Stack';
import { InlineSwitch } from '../Switch/Switch';
import { TagsInput } from '../TagsInput/TagsInput';
import { Text } from '../Text/Text';

import { BasicAuthSettings } from './BasicAuthSettings';
import { CustomHeadersSettings } from './CustomHeadersSettings';
import { HttpProxySettings } from './HttpProxySettings';
import { SecureSocksProxySettings } from './SecureSocksProxySettings';
import { TLSAuthSettings } from './TLSAuthSettings';
import { HttpSettingsProps } from './types';

const ACCESS_HELP_ID = 'grafana-http-access-help';

const HttpAccessHelp = () => {
  return (
    <Alert
      severity="info"
      title={t('grafana-ui.data-source-http-settings.access-help-title', 'Access help')}
      topSpacing={3}
      id={ACCESS_HELP_ID}
    >
      <p>
        <Trans i18nKey="grafana-ui.data-source-http-settings.access-help-details">
          Access mode controls how requests to the data source will be handled.
          <strong>
            &nbsp;<i>Server</i>
          </strong>{' '}
          should be the preferred way if nothing else is stated.
        </Trans>
      </p>
      <Trans i18nKey="grafana-ui.data-source-http-settings.server-mode-title">
        <Text weight="medium">Server access mode (Default):</Text>
      </Trans>
      <p>
        <Trans i18nKey="grafana-ui.data-source-http-settings.server-mode-description">
          All requests will be made from the browser to Grafana backend/server which in turn will forward the requests
          to the data source and by that circumvent possible Cross-Origin Resource Sharing (CORS) requirements. The URL
          needs to be accessible from the grafana backend/server if you select this access mode.
        </Trans>
      </p>
      <Trans i18nKey="grafana-ui.data-source-http-settings.browser-mode-title">
        <Text weight="medium">Browser access mode:</Text>
      </Trans>
      <p>
        <Trans i18nKey="grafana-ui.data-source-http-settings.browser-mode-description">
          All requests will be made from the browser directly to the data source and may be subject to Cross-Origin
          Resource Sharing (CORS) requirements. The URL needs to be accessible from the browser if you select this
          access mode.
        </Trans>
      </p>
    </Alert>
  );
};

const LABEL_WIDTH = 26;

/**
 * @deprecated Use components from `@grafana/plugin-ui` instead, according to the [migration guide](https://github.com/grafana/plugin-ui/blob/main/src/components/ConfigEditor/migrating-from-datasource-http-settings.md).
 */
export const DataSourceHttpSettings = (props: HttpSettingsProps) => {
  const {
    defaultUrl,
    dataSourceConfig,
    onChange,
    showAccessOptions,
    sigV4AuthToggleEnabled,
    showForwardOAuthIdentityOption,
    azureAuthSettings,
    renderSigV4Editor,
    secureSocksDSProxyEnabled,
    urlLabel,
    urlDocs,
  } = props;

  const ACCESS_OPTIONS: Array<SelectableValue<string>> = useMemo(
    () => [
      {
        label: t('grafana-ui.data-source-http-settings.server-mode-label', 'Server (default)'),
        value: 'proxy',
      },
      {
        label: t('grafana-ui.data-source-http-settings.browser-mode-label', 'Browser'),
        value: 'direct',
      },
    ],
    []
  );

  const DEFAULT_ACCESS_OPTION = useMemo(() => ACCESS_OPTIONS[0], [ACCESS_OPTIONS]);

  const [isAccessHelpVisible, setIsAccessHelpVisible] = useState(false);
  const [azureAuthEnabled, setAzureAuthEnabled] = useState(false);
  const theme = useTheme2();
  let urlTooltip;

  const onSettingsChange = useCallback(
    (change: Partial<typeof dataSourceConfig>) => {
      // Azure Authentication doesn't work correctly when Forward OAuth Identity is enabled.
      // The Authorization header that has been set by the ApplyAzureAuth middleware gets overwritten
      // with the Authorization header set by the OAuthTokenMiddleware.
      const isAzureAuthEnabled =
        (azureAuthSettings?.azureAuthSupported && azureAuthSettings.getAzureAuthEnabled(dataSourceConfig)) || false;
      setAzureAuthEnabled(isAzureAuthEnabled);
      if (isAzureAuthEnabled) {
        const tmpOauthPassThru =
          dataSourceConfig.jsonData.oauthPassThru !== undefined ? dataSourceConfig.jsonData.oauthPassThru : false;
        change = {
          ...change,
          jsonData: {
            ...dataSourceConfig.jsonData,
            oauthPassThru: isAzureAuthEnabled ? false : tmpOauthPassThru,
          },
        };
      }

      onChange({
        ...dataSourceConfig,
        ...change,
      });
    },
    [azureAuthSettings, dataSourceConfig, onChange]
  );

  switch (dataSourceConfig.access) {
    case 'direct':
      urlTooltip = (
        <>
          <Trans i18nKey="grafana-ui.data-source-http-settings.direct-url-tooltip">
            Your access method is <em>Browser</em>, this means the URL needs to be accessible from the browser.
          </Trans>
          {urlDocs}
        </>
      );
      break;
    case 'proxy':
      urlTooltip = (
        <>
          <Trans i18nKey="grafana-ui.data-source-http-settings.proxy-url-tooltip">
            Your access method is <em>Server</em>, this means the URL needs to be accessible from the grafana
            backend/server.
          </Trans>
          {urlDocs}
        </>
      );
      break;
    default:
      urlTooltip = (
        <>
          <Trans i18nKey="grafana-ui.data-source-http-settings.default-url-tooltip">
            Specify a complete HTTP URL (for example http://your_server:8080)
          </Trans>
          {urlDocs}
        </>
      );
  }

  const isValidUrl = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/.test(
    dataSourceConfig.url
  );

  const gridLayout = css({
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: theme.spacing(0.5),
  });

  const fromFieldId = useId();

  return (
    <Stack direction="column" gap={5}>
      <section>
        <h3 className="page-heading">
          <Trans i18nKey="grafana-ui.data-source-http-settings.heading">HTTP</Trans>
        </h3>

        <Field
          label={urlLabel ?? 'URL'}
          description={urlTooltip}
          invalid={!isValidUrl}
          error={!isValidUrl && t('grafana-ui.data-source-http-settings.invalid-url-error', 'Invalid URL')}
          disabled={dataSourceConfig.readOnly}
        >
          <Input
            id={fromFieldId}
            width={40}
            placeholder={defaultUrl}
            value={dataSourceConfig.url}
            data-testid={selectors.components.DataSource.DataSourceHttpSettings.urlInput}
            onChange={(event) => onSettingsChange({ url: event.currentTarget.value })}
          />
        </Field>

        {showAccessOptions && (
          <>
            <Field
              label={t('grafana-ui.data-source-http-settings.access-label', 'Access')}
              disabled={dataSourceConfig.readOnly}
            >
              <Stack direction="row" gap={0.5}>
                <RadioButtonGroup
                  aria-label={t('grafana-ui.data-source-http-settings.access-label', 'Access')}
                  options={ACCESS_OPTIONS}
                  value={
                    ACCESS_OPTIONS.find((o) => o.value === dataSourceConfig.access)?.value ||
                    DEFAULT_ACCESS_OPTION.value
                  }
                  onChange={(selectedValue) => onSettingsChange({ access: selectedValue })}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  fill="outline"
                  onClick={() => setIsAccessHelpVisible((isVisible) => !isVisible)}
                  aria-expanded={isAccessHelpVisible}
                  aria-controls={ACCESS_HELP_ID}
                >
                  <Trans i18nKey="grafana-ui.data-source-http-settings.access-help">
                    Help&nbsp;
                    <Icon name={isAccessHelpVisible ? 'angle-down' : 'angle-right'} />
                  </Trans>
                </Button>
              </Stack>
            </Field>

            {isAccessHelpVisible && <HttpAccessHelp />}
          </>
        )}
        {dataSourceConfig.access === 'proxy' && (
          <>
            <Field
              label={t('grafana-ui.data-source-http-settings.allowed-cookies', 'Allowed cookies')}
              description={t(
                'grafana-ui.data-source-http-settings.allowed-cookies-description',
                'Grafana proxy deletes forwarded cookies by default. Specify cookies by name that should be forwarded to the data source.'
              )}
            >
              <TagsInput
                tags={dataSourceConfig.jsonData.keepCookies}
                width={40}
                onChange={(cookies) =>
                  onSettingsChange({ jsonData: { ...dataSourceConfig.jsonData, keepCookies: cookies } })
                }
                disabled={dataSourceConfig.readOnly}
              />
            </Field>

            <Field
              label={t('grafana-ui.data-source-http-settings.timeout-label', 'Timeout')}
              description={t(
                'grafana-ui.data-source-http-settings.timeout-description',
                'HTTP request timeout in seconds'
              )}
              disabled={dataSourceConfig.readOnly}
            >
              <Input
                type="number"
                width={40}
                placeholder={t('grafana-ui.data-source-http-settings.timeout-placeholder', 'Timeout in seconds')}
                value={dataSourceConfig.jsonData.timeout}
                onChange={(event) => {
                  onSettingsChange({
                    jsonData: { ...dataSourceConfig.jsonData, timeout: parseInt(event.currentTarget.value, 10) },
                  });
                }}
              />
            </Field>
          </>
        )}
      </section>

      <section>
        <h3 className="page-heading">
          <Trans i18nKey="grafana-ui.data-source-http-settings.auth">Auth</Trans>
        </h3>
        <Stack direction="column" gap={4}>
          <div>
            <div className={gridLayout}>
              <InlineField
                label={t('grafana-ui.data-source-http-settings.basic-auth-label', 'Basic auth')}
                labelWidth={LABEL_WIDTH}
                disabled={dataSourceConfig.readOnly}
              >
                <InlineSwitch
                  id="http-settings-basic-auth"
                  value={dataSourceConfig.basicAuth}
                  onChange={(event) => {
                    onSettingsChange({ basicAuth: event!.currentTarget.checked });
                  }}
                />
              </InlineField>

              <InlineField
                label={t('grafana-ui.data-source-http-settings.with-credentials-label', 'With Credentials')}
                tooltip={t(
                  'grafana-ui.data-source-http-settings.with-credentials-tooltip',
                  'Whether credentials such as cookies or auth headers should be sent with cross-site requests.'
                )}
                labelWidth={LABEL_WIDTH}
                disabled={dataSourceConfig.readOnly}
              >
                <InlineSwitch
                  id="http-settings-with-credentials"
                  value={dataSourceConfig.withCredentials}
                  onChange={(event) => {
                    onSettingsChange({ withCredentials: event!.currentTarget.checked });
                  }}
                />
              </InlineField>

              {azureAuthSettings?.azureAuthSupported && (
                <InlineField
                  label={t('grafana-ui.data-source-http-settings.azure-auth-label', 'Azure Authentication')}
                  tooltip={t(
                    'grafana-ui.data-source-http-settings.azure-auth-tooltip',
                    'Use Azure authentication for Azure endpoint.'
                  )}
                  labelWidth={LABEL_WIDTH}
                  disabled={dataSourceConfig.readOnly}
                >
                  <InlineSwitch
                    id="http-settings-azure-auth"
                    value={azureAuthEnabled}
                    onChange={(event) => {
                      onSettingsChange(
                        azureAuthSettings.setAzureAuthEnabled(dataSourceConfig, event!.currentTarget.checked)
                      );
                    }}
                  />
                </InlineField>
              )}

              {sigV4AuthToggleEnabled && (
                <InlineField
                  label={t('grafana-ui.data-source-http-settings.sigv4-auth-label', 'SigV4 auth')}
                  labelWidth={LABEL_WIDTH}
                  disabled={dataSourceConfig.readOnly}
                >
                  <InlineSwitch
                    id="http-settings-sigv4-auth"
                    value={dataSourceConfig.jsonData.sigV4Auth || false}
                    onChange={(event) => {
                      onSettingsChange({
                        jsonData: { ...dataSourceConfig.jsonData, sigV4Auth: event!.currentTarget.checked },
                      });
                    }}
                  />
                </InlineField>
              )}
            </div>

            {dataSourceConfig.access === 'proxy' && (
              <HttpProxySettings
                dataSourceConfig={dataSourceConfig}
                onChange={(jsonData) => onSettingsChange({ jsonData })}
                showForwardOAuthIdentityOption={azureAuthEnabled ? false : showForwardOAuthIdentityOption}
              />
            )}
          </div>

          {dataSourceConfig.basicAuth && (
            <section>
              <Text variant="h6" element="h4">
                <Trans i18nKey="grafana-ui.data-source-http-settings.basic-auth">Basic Auth Details</Trans>
              </Text>

              <BasicAuthSettings {...props} />
            </section>
          )}

          {azureAuthSettings?.azureAuthSupported && azureAuthEnabled && azureAuthSettings.azureSettingsUI && (
            <azureAuthSettings.azureSettingsUI dataSourceConfig={dataSourceConfig} onChange={onChange} />
          )}

          {dataSourceConfig.jsonData.sigV4Auth && sigV4AuthToggleEnabled && renderSigV4Editor}
          {(dataSourceConfig.jsonData.tlsAuth || dataSourceConfig.jsonData.tlsAuthWithCACert) && (
            <TLSAuthSettings dataSourceConfig={dataSourceConfig} onChange={onChange} />
          )}

          {dataSourceConfig.access === 'proxy' && (
            <CustomHeadersSettings dataSourceConfig={dataSourceConfig} onChange={onChange} />
          )}
        </Stack>
      </section>
      {secureSocksDSProxyEnabled && <SecureSocksProxySettings options={dataSourceConfig} onOptionsChange={onChange} />}
    </Stack>
  );
};
