import { render, screen } from 'test/test-utils';

import { type ComponentTypeWithExtensionMeta, PluginExtensionPoints } from '@grafana/data';
import { setPluginComponentsHook } from '@grafana/runtime';
import { ASSISTANT_ONBOARDING_APP_ID } from 'app/core/appPluginIds';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { type CatalogPlugin } from '../../types';

import { AssistantOverview } from './AssistantOverview';

jest.mock('../../state/hooks', () => ({
  useInstall: () => jest.fn(),
  useInstallStatus: () => ({ isInstalling: false }),
}));

const plugin = { id: 'grafana-assistant-app', isInstalled: true } as CatalogPlugin;

const overviewComponent = (pluginId: string, content: string): ComponentTypeWithExtensionMeta<{}> =>
  createComponentWithMeta(
    { pluginId, title: content, component: () => <div>{content}</div> },
    PluginExtensionPoints.AssistantOnboardingOverview
  );

describe('AssistantOverview', () => {
  it('renders the onboarding plugin overview and ignores other plugins', async () => {
    const components = [
      overviewComponent(ASSISTANT_ONBOARDING_APP_ID, 'Onboarding overview'),
      overviewComponent('other-app', 'Other overview'),
    ];
    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components: extensionPointId === PluginExtensionPoints.AssistantOnboardingOverview ? components : [],
    }));

    render(<AssistantOverview plugin={plugin} fallback={<div>Fallback</div>} />);

    expect(await screen.findByText('Onboarding overview')).toBeInTheDocument();
    expect(screen.queryByText(/Other overview/)).not.toBeInTheDocument();
    expect(screen.queryByText('Fallback')).not.toBeInTheDocument();
  });

  it('renders the fallback when the onboarding plugin adds no overview', async () => {
    setPluginComponentsHook(() => ({
      isLoading: false,
      components: [overviewComponent('other-app', 'Other overview')],
    }));

    render(<AssistantOverview plugin={plugin} fallback={<div>Fallback</div>} />);

    expect(await screen.findByText('Fallback')).toBeInTheDocument();
    expect(screen.queryByText(/Other overview/)).not.toBeInTheDocument();
  });
});
