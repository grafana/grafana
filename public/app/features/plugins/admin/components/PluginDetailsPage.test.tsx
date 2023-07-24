import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { PluginSignatureStatus } from '@grafana/data';

import { PluginDetailsPage } from './PluginDetailsPage';

jest.mock('../state/hooks', () => ({
  __esModule: true,
  ...jest.requireActual('../state/hooks'),
  useGetSingle: jest.fn().mockImplementation((id: string) => {
    return {
      description: 'The test plugin',
      downloads: 5,
      id: 'test-plugin',
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
      angularDetected: id === 'angular',
    };
  }),
}));

describe('PluginDetailsAngularDeprecation', () => {
  afterAll(() => {
    jest.resetAllMocks();
  });

  it('renders the component for angular plugins', async () => {
    await act(async () =>
      render(
        <TestProvider>
          <PluginDetailsPage pluginId="angular" />
        </TestProvider>
      )
    );
    expect(screen.getByText(/angular plugin/i)).toBeVisible();
  });

  it('does not render the component for non-angular plugins', async () => {
    await act(async () =>
      render(
        <TestProvider>
          <PluginDetailsPage pluginId="not-angular" />
        </TestProvider>
      )
    );
    expect(screen.queryByText(/angular plugin/i)).toBeNull();
  });
});
