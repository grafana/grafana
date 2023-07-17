import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { PluginSignatureStatus } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';

import { PluginDetailsPage } from './PluginDetailsPage';

const angularPluginId = 'angular';

jest.mock('../state/hooks', () => ({
  __esModule: true,
  ...jest.requireActual('../state/hooks'),
  useGetSingle: jest.fn().mockImplementation((id: string) => {
    return {
      description: 'The test plugin',
      downloads: 5,
      id,
      info: {
        logos: { small: '', large: '' },
      },
      name: 'Testing Plugin',
      orgName: 'Test',
      popularity: 0,
      signature: PluginSignatureStatus.valid,
      publishedAt: '2020-09-01',
      updatedAt: '2021-06-28',
      hasUpdate: false,
      isInstalled: false,
      isCore: false,
      isDev: false,
      isEnterprise: false,
      isDisabled: false,
      isPublished: true,
      angularDetected: id === angularPluginId,
    };
  }),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

function renderPage(pluginId: string) {
  return act(async () =>
    render(
      <TestProvider>
        <PluginDetailsPage pluginId={pluginId} />
      </TestProvider>
    )
  );
}

describe('PluginDetailsAngularDeprecation', () => {
  afterAll(() => {
    jest.resetAllMocks();
  });

  it('renders the component for angular plugins', async () => {
    await renderPage(angularPluginId);
    expect(screen.getByText(/angular plugin/i)).toBeVisible();
  });

  it('does not render the component for non-angular plugins', async () => {
    await renderPage('not-angular');
    expect(screen.queryByText(/angular plugin/i)).toBeNull();
  });

  it('reports interaction when clicking on the link', async () => {
    await renderPage(angularPluginId);
    const c = 'Read more on Angular deprecation.';
    await waitFor(() => expect(screen.getByText(c)).toBeInTheDocument());
    await userEvent.click(screen.getByText(c));
    expect(reportInteraction).toHaveBeenCalledWith('angular_deprecation_docs_clicked', {
      pluginId: angularPluginId,
    });
  });
});
