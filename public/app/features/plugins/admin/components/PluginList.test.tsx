import { render } from '@testing-library/react';
import React from 'react';
import { useLocation } from 'react-router-dom';

import { PluginSignatureStatus } from '@grafana/data';
import { config } from '@grafana/runtime';

import { CatalogPlugin, PluginListDisplayMode } from '../types';

import { PluginList } from './PluginList';

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    appSubUrl: '',
  },
}));

const useLocationMock = useLocation as jest.Mock;

const getMockPlugin = (id: string): CatalogPlugin => {
  return {
    description: 'The test plugin',
    downloads: 5,
    id,
    info: {
      logos: {
        small: 'https://grafana.com/api/plugins/test-plugin/versions/0.0.10/logos/small',
        large: 'https://grafana.com/api/plugins/test-plugin/versions/0.0.10/logos/large',
      },
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
  };
};

const plugins = [getMockPlugin('test1'), getMockPlugin('test2'), getMockPlugin('test3')];
describe('PluginList', () => {
  beforeAll(() => {
    useLocationMock.mockImplementation(() => ({
      pathname: '/plugins',
    }));
  });

  it('renders a plugin list', () => {
    const result = render(<PluginList plugins={plugins} displayMode={PluginListDisplayMode.List} />);
    expect(result.getByTestId('plugin-list')).toBeTruthy();
    const links = result.getAllByRole('link');
    for (const link of links) {
      expect(link).toHaveAttribute('href', expect.stringMatching(/^\/plugins\/test\d/));
    }
  });
  it('renders a plugin list with a subAppUrl', () => {
    config.appSubUrl = 'test-sub-url';
    const result = render(<PluginList plugins={plugins} displayMode={PluginListDisplayMode.List} />);
    expect(result.getByTestId('plugin-list')).toBeTruthy();
    const links = result.getAllByRole('link');
    for (const link of links) {
      expect(link).toHaveAttribute('href', expect.stringMatching(/^test-sub-url\/plugins\/test\d/));
    }
  });
});
