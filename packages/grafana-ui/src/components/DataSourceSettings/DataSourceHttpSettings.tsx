import { css, cx } from '@emotion/css';
import { useState, useCallback, useId } from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { useTheme2 } from '../../themes';
import { Trans } from '../../utils/i18n';
import { Alert } from '../Alert/Alert';
import { Button } from '../Button';
import { Combobox } from '../Combobox/Combobox';
import { ComboboxOption } from '../Combobox/types';
import { FormField } from '../FormField/FormField';
import { InlineFormLabel } from '../FormLabel/FormLabel';
import { InlineField } from '../Forms/InlineField';
import { Input } from '../Forms/Legacy/Input/Input';
import { Icon } from '../Icon/Icon';
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

const ACCESS_OPTIONS: Array<ComboboxOption<string>> = [
  {
    label: 'Server (default)',
    value: 'proxy',
  },
  {
    label: 'Browser',
    value: 'direct',
  },
];

const DEFAULT_ACCESS_OPTION = {
  label: 'Server (default)',
  value: 'proxy',
};

const HttpAccessHelp = () => {
  return (
    <Alert severity="info" title="" topSpacing={3}>
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

  const notValidStyle = css({
    boxShadow: `inset 0 0px 5px ${theme.v1.palette.red}`,
  });

  const gridLayout = css({
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: theme.spacing(0.5),
  });

  const inputStyle = cx({ [`width-20`]: true, [notValidStyle]: !isValidUrl });

  const fromFieldId = useId();

  const urlInput = (
    <Input
      id={fromFieldId}
      className={inputStyle}
      placeholder={defaultUrl}
      value={dataSourceConfig.url}
      data-testid={selectors.components.DataSource.DataSourceHttpSettings.urlInput}
      onChange={(event) => onSettingsChange({ url: event.currentTarget.value })}
      disabled={dataSourceConfig.readOnly}
    />
  );

  return (
    <Stack direction="column" gap={5}>
      <section>
        <h3 className="page-heading">
          <Trans i18nKey="grafana-ui.data-source-http-settings.heading">HTTP</Trans>
        </h3>

        <Stack direction="column" gap={0.5}>
          <FormField
            interactive={urlDocs ? true : false}
            label={urlLabel ?? 'URL'}
            labelWidth={13}
            tooltip={urlTooltip}
            inputEl={urlInput}
          />

          {showAccessOptions && (
            <>
              <Stack direction="row" gap={0.5}>
                <InlineField label="Access" labelWidth={26} disabled={dataSourceConfig.readOnly}>
                  <Combobox
                    width={40}
                    options={ACCESS_OPTIONS}
                    value={
                      ACCESS_OPTIONS.filter((o) => o.value === dataSourceConfig.access)[0] || DEFAULT_ACCESS_OPTION
                    }
                    onChange={(selectedValue) => onSettingsChange({ access: selectedValue.value })}
                  />
                </InlineField>

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  fill="outline"
                  onClick={() => setIsAccessHelpVisible((isVisible) => !isVisible)}
                >
                  <Trans i18nKey="grafana-ui.data-source-http-settings.access-help">
                    Help&nbsp;
                    <Icon name={isAccessHelpVisible ? 'angle-down' : 'angle-right'} />
                  </Trans>
                </Button>
              </Stack>
              {isAccessHelpVisible && <HttpAccessHelp />}
            </>
          )}
          {dataSourceConfig.access === 'proxy' && (
            <>
              <Stack direction="row" gap={0}>
                <InlineFormLabel
                  width={13}
                  tooltip="Grafana proxy deletes forwarded cookies by default. Specify cookies by name that should be forwarded to the data source."
                >
                  <Trans i18nKey="grafana-ui.data-source-http-settings.allowed-cookies">Allowed cookies</Trans>
                </InlineFormLabel>
                <TagsInput
                  tags={dataSourceConfig.jsonData.keepCookies}
                  width={40}
                  onChange={(cookies) =>
                    onSettingsChange({ jsonData: { ...dataSourceConfig.jsonData, keepCookies: cookies } })
                  }
                  disabled={dataSourceConfig.readOnly}
                />
              </Stack>
              <FormField
                label="Timeout"
                type="number"
                labelWidth={13}
                inputWidth={20}
                tooltip="HTTP request timeout in seconds"
                placeholder="Timeout in seconds"
                aria-label="Timeout in seconds"
                value={dataSourceConfig.jsonData.timeout}
                onChange={(event) => {
                  onSettingsChange({
                    jsonData: { ...dataSourceConfig.jsonData, timeout: parseInt(event.currentTarget.value, 10) },
                  });
                }}
                disabled={dataSourceConfig.readOnly}
              />
            </>
          )}
        </Stack>
      </section>

      <section>
        <h3 className="page-heading">
          <Trans i18nKey="grafana-ui.data-source-http-settings.auth">Auth</Trans>
        </h3>
        <Stack direction="column" gap={4}>
          <div className={gridLayout}>
            <InlineField label="Basic auth" labelWidth={LABEL_WIDTH} disabled={dataSourceConfig.readOnly}>
              <InlineSwitch
                id="http-settings-basic-auth"
                value={dataSourceConfig.basicAuth}
                onChange={(event) => {
                  onSettingsChange({ basicAuth: event!.currentTarget.checked });
                }}
              />
            </InlineField>

            <InlineField
              label="With Credentials"
              tooltip="Whether credentials such as cookies or auth headers should be sent with cross-site requests."
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
                label="Azure Authentication"
                tooltip="Use Azure authentication for Azure endpoint."
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
              <InlineField label="SigV4 auth" labelWidth={LABEL_WIDTH} disabled={dataSourceConfig.readOnly}>
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
