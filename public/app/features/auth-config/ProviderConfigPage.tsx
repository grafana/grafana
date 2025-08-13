import { useEffect } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Stack, Text } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { PageNotFound } from 'app/core/components/PageNotFound/PageNotFound';
import { useDispatch, useSelector } from 'app/types/store';

import { ProviderConfigForm } from './ProviderConfigForm';
import { UIMap } from './constants';
import { loadProviders } from './state/actions';
import { SSOProvider } from './types';

const getPageNav = (config?: SSOProvider): NavModelItem => {
  if (!config) {
    return {
      text: t('auth-config.get-page-nav.text.authentication', 'Authentication'),
      subTitle: t(
        'auth-config.get-page-nav.subTitle.configure-authentication-providers',
        'Configure authentication providers'
      ),
      icon: 'shield',
      id: 'authentication',
    };
  }

  const providerDisplayName = UIMap[config.provider][1] || config.provider.toUpperCase();

  return {
    text: providerDisplayName || '',
    subTitle: `To configure ${providerDisplayName} OAuth2 you must register your application with ${providerDisplayName}. The provider will generate a Client ID and Client Secret for you to use.`,
    icon: config.settings.icon || 'shield',
    id: config.provider,
  };
};

/**
 * Separate the Page logic from the Content logic for easier testing.
 */
export const ProviderConfigPage = () => {
  const dispatch = useDispatch();
  const { isLoading, providers } = useSelector((store) => store.authConfig);
  const { provider = '' } = useParams();
  const config = providers.find((config) => config.provider === provider);

  useEffect(() => {
    dispatch(loadProviders(provider));
  }, [dispatch, provider]);

  if (!config || !config.provider || !UIMap[config.provider]) {
    return <PageNotFound />;
  }

  const pageNav = getPageNav(config);

  return (
    <Page
      navId="authentication"
      pageNav={pageNav}
      renderTitle={(title) => (
        <Stack gap={2} alignItems="center">
          <Text variant={'h1'}>{title}</Text>
          <Badge
            text={
              config.settings.enabled
                ? t('auth-config.provider-config-page.text-badge-enabled', 'Enabled')
                : t('auth-config.provider-config-page.text-badge-not-enabled', 'Not enabled')
            }
            color={config.settings.enabled ? 'green' : 'blue'}
            icon={config.settings.enabled ? 'check' : undefined}
          />
        </Stack>
      )}
    >
      <ProviderConfigForm config={config} isLoading={isLoading} provider={provider} />
    </Page>
  );
};

export default ProviderConfigPage;
