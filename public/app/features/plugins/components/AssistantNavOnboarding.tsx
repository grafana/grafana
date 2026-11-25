import { PluginExtensionPoints } from '@grafana/data';
import { renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { ASSISTANT_APP_ID, ASSISTANT_ONBOARDING_APP_ID } from 'app/core/appPluginIds';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { useInstall, useInstallStatus } from '../admin/state/hooks';

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
  const { components, isLoading } = usePluginComponents<AssistantNavOnboardingProps>({
    extensionPointId: PluginExtensionPoints.AssistantOnboardingPage,
  });

  if (isLoading) {
    return <PageLoader />;
  }

  const onboardingPage = renderLimitedComponents<AssistantNavOnboardingProps>({
    props: {
      isInstalled: false,
      isConnected: false,
      isLoading: false,
      isInstalling,
      canInstall: contextSrv.hasPermission(AccessControlAction.PluginsInstall),
      onInstall: async () => {
        const result = await installPlugin(ASSISTANT_APP_ID);
        if (!('error' in result)) {
          window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
        }
      },
    },
    limit: 1,
    components,
    pluginId: ASSISTANT_ONBOARDING_APP_ID,
  });

  return onboardingPage ?? <EntityNotFound entity="App" />;
}
