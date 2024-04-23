import React, { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { NavModelItem } from '@grafana/data';
import { Badge, Stack, Text } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { StoreState } from '../../types';

import { ProviderConfigForm } from './ProviderConfigForm';
import { UIMap } from './constants';
import { loadProviders } from './state/actions';
import { SSOProvider } from './types';

const getPageNav = (config?: SSOProvider): NavModelItem => {
  if (!config) {
    return {
      text: 'Authentication',
      subTitle: 'Configure authentication providers',
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

interface RouteProps extends GrafanaRouteComponentProps<{ provider: string }> {}

function mapStateToProps(state: StoreState, props: RouteProps) {
  const { isLoading, providers } = state.authConfig;
  const { provider } = props.match.params;
  const config = providers.find((config) => config.provider === provider);
  return {
    config,
    isLoading,
    provider,
  };
}

const mapDispatchToProps = {
  loadProviders,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
export type Props = ConnectedProps<typeof connector>;

/**
 * Separate the Page logic from the Content logic for easier testing.
 */
export const ProviderConfigPage = ({ config, loadProviders, isLoading, provider }: Props) => {
  const pageNav = getPageNav(config);

  useEffect(() => {
    loadProviders(provider);
  }, [loadProviders, provider]);

  if (!config) {
    return null;
  }
  return (
    <Page
      navId="authentication"
      pageNav={pageNav}
      renderTitle={(title) => (
        <Stack gap={2} alignItems="center">
          <Text variant={'h1'}>{title}</Text>
          <Badge
            text={config.settings.enabled ? 'Enabled' : 'Not enabled'}
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

export default connector(ProviderConfigPage);
