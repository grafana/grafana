import { render, screen } from '@testing-library/react';
import React from 'react';

import { PluginSignatureStatus } from '@grafana/data';

import { CatalogPlugin } from '../types';

import { PluginDetailsAngularDeprecation } from './PluginDetailsAngularDeprecation';

describe('PluginDetailsAngularDeprecation', () => {
  const plugin: CatalogPlugin = {
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
    angularDetected: false,
  };

  it('renders the component for angular plugins', () => {
    render(<PluginDetailsAngularDeprecation plugin={{ ...plugin, angularDetected: true }} />);
    expect(screen.getByText(/angular plugin/i)).toBeVisible();
  });

  it('does not render the component for non-angular plugins', () => {
    render(<PluginDetailsAngularDeprecation plugin={{ ...plugin, angularDetected: false }} />);
    expect(screen.queryByText(/angular plugin/i)).toBeNull();
  });
});
