import { usePluginComponent } from '@grafana/runtime';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { useInstall, useInstallStatus } from '../admin/state/hooks';

const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';
const ASSISTANT_ONBOARDING_NAV_COMPONENT_ID = 'grafana-assistant-onboarding-app/nav-onboarding/v1';
const RELOAD_DELAY_MS = 1500;

interface AssistantNavOnboardingProps {
  isInstalled: boolean;
  isConnected: boolean;
  isLoading: boolean;
  isInstalling: boolean;
  canInstall: boolean;
  onInstall: () => void;
}

export function AssistantNavOnboarding() {
  const installPlugin = useInstall();
  const { isInstalling } = useInstallStatus();
  const { component: OnboardingPage, isLoading } = usePluginComponent<AssistantNavOnboardingProps>(
    ASSISTANT_ONBOARDING_NAV_COMPONENT_ID
  );

  if (isLoading) {
    return <PageLoader />;
  }

  if (!OnboardingPage) {
    return <EntityNotFound entity="App" />;
  }

  return (
    <OnboardingPage
      isInstalled={false}
      isConnected={false}
      isLoading={false}
      isInstalling={isInstalling}
      canInstall={contextSrv.hasPermission(AccessControlAction.PluginsInstall)}
      onInstall={async () => {
        const result = await installPlugin(ASSISTANT_PLUGIN_ID);
        if (!('error' in result)) {
          window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
        }
      }}
    />
  );
}
