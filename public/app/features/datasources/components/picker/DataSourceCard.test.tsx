import { render, screen } from '@testing-library/react';

import {
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  type PluginMetaInfo,
  PluginType,
} from '@grafana/data';
import { setDataSourceInstanceSettings } from '@grafana/runtime/internal';

import { DataSourceCard } from './DataSourceCard';

const pluginMetaInfo: PluginMetaInfo = {
  author: { name: '' },
  description: '',
  screenshots: [],
  version: '',
  updated: '',
  links: [],
  logos: { small: '', large: '' },
};

function createPluginMeta(name: string): DataSourcePluginMeta {
  return { builtIn: false, name, id: name, type: PluginType.datasource, baseUrl: '', info: pluginMetaInfo, module: '' };
}

function createDS(name: string, isDefault?: boolean): DataSourceInstanceSettings {
  return {
    name,
    uid: name + '-uid',
    meta: createPluginMeta(name),
    access: 'direct',
    jsonData: {},
    type: 'test-type',
    readOnly: true,
    isDefault,
  };
}

function renderCard(ds: DataSourceInstanceSettings) {
  setDataSourceInstanceSettings({ [ds.name]: ds });
  render(<DataSourceCard ds={ds} selected={false} />);
}

describe('DataSourceCard', () => {
  it('shows the default tag when the data source is the org default', async () => {
    renderCard(createDS('mock.datasource.1', true));

    expect(await screen.findByText('default')).toBeInTheDocument();
  });

  it('does not show the default tag when the data source is not the org default', async () => {
    renderCard(createDS('mock.datasource.1', false));

    // Give the async resolution a chance to run before asserting it stays absent.
    await screen.findByRole('img', { name: 'mock.datasource.1 Logo' });
    expect(screen.queryByText('default')).not.toBeInTheDocument();
  });

  it('does not show the default tag when isDefault is undefined', async () => {
    renderCard(createDS('mock.datasource.1'));

    await screen.findByRole('img', { name: 'mock.datasource.1 Logo' });
    expect(screen.queryByText('default')).not.toBeInTheDocument();
  });
});
