import { render, screen } from 'test/test-utils';

import { type ComponentTypeWithExtensionMeta, PluginExtensionPoints } from '@grafana/data';
import { setPluginComponentsHook } from '@grafana/runtime';
import { ASSISTANT_ONBOARDING_APP_ID } from 'app/core/appPluginIds';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { AssistantNavOnboarding } from './AssistantNavOnboarding';

jest.mock('../admin/state/hooks', () => ({
  useInstall: () => jest.fn(),
  useInstallStatus: () => ({ isInstalling: false }),
}));

const pageComponent = (pluginId: string, content: string): ComponentTypeWithExtensionMeta<{}> =>
  createComponentWithMeta(
    { pluginId, title: content, component: () => <div>{content}</div> },
    PluginExtensionPoints.AssistantOnboardingPage
  );

describe('AssistantNavOnboarding', () => {
  it('renders the onboarding plugin page and ignores other plugins', async () => {
    const components = [
      pageComponent(ASSISTANT_ONBOARDING_APP_ID, 'Onboarding page'),
      pageComponent('other-app', 'Other page'),
    ];
    setPluginComponentsHook(({ extensionPointId }) => ({
      isLoading: false,
      components: extensionPointId === PluginExtensionPoints.AssistantOnboardingPage ? components : [],
    }));

    render(<AssistantNavOnboarding />);

    expect(await screen.findByText('Onboarding page')).toBeInTheDocument();
    expect(screen.queryByText(/Other page/)).not.toBeInTheDocument();
  });

  it('shows not found when the onboarding plugin adds no page', async () => {
    setPluginComponentsHook(() => ({ isLoading: false, components: [pageComponent('other-app', 'Other page')] }));

    render(<AssistantNavOnboarding />);

    expect(await screen.findByText(/App not found/)).toBeInTheDocument();
    expect(screen.queryByText(/Other page/)).not.toBeInTheDocument();
  });
});
