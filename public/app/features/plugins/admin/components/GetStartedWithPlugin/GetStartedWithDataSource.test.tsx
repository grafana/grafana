import { render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { PluginSignatureStatus } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';

import { CatalogPlugin } from '../../types';

import { GetStartedWithDataSource } from './GetStartedWithDataSource';

const plugin: CatalogPlugin = {
  description: 'The test plugin',
  downloads: 5,
  id: 'test-plugin',
  info: {
    logos: { small: '', large: '' },
    keywords: ['test', 'plugin'],
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
  isDeprecated: false,
  isPublished: true,
  isManaged: false,
  isPreinstalled: { found: false, withVersion: false },
};

describe('GetStartedWithDataSource', () => {
  const oldPluginAdminExternalManageEnabled = config.pluginAdminExternalManageEnabled;

  config.pluginAdminExternalManageEnabled = true;

  const contextSrv = new ContextSrv();
  contextSrv.user.permissions = {
    [AccessControlAction.DataSourcesCreate]: true,
    [AccessControlAction.DataSourcesWrite]: true,
  };
  setContextSrv(contextSrv);

  afterAll(() => {
    config.pluginAdminExternalManageEnabled = oldPluginAdminExternalManageEnabled;
  });

  it('should disable button when pluginAdminExternalManaged is enabled, but plugin.isFullyInstalled is false', () => {
    render(
      <TestProvider>
        <GetStartedWithDataSource plugin={{ ...plugin, isFullyInstalled: false }} />
      </TestProvider>
    );

    const el = screen.getByRole('button', { hidden: true });
    expect(el).toHaveTextContent(/Add new data source/i);
    expect(el).toBeDisabled();
  });

  it('should disable button when pluginAdminExternalManaged enabled, but plugin.isFullyInstalled is true', () => {
    render(
      <TestProvider>
        <GetStartedWithDataSource plugin={{ ...plugin, isFullyInstalled: true }} />
      </TestProvider>
    );

    const el = screen.getByRole('button', { hidden: true });
    expect(el).toHaveTextContent(/Add new data source/i);
    expect(el).toBeEnabled();
  });
});
