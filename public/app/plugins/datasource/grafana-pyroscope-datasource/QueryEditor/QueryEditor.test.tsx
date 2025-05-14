import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CoreApp, PluginType } from '@grafana/data';
import { setPluginExtensionsHook } from '@grafana/runtime';

import { PyroscopeDataSource } from '../datasource';
import { mockFetchPyroscopeDatasourceSettings } from '../datasource.test';
import { ProfileTypeMessage } from '../types';

import { Props, QueryEditor } from './QueryEditor';

describe('QueryEditor', () => {
  beforeEach(() => {
    setPluginExtensionsHook(() => ({ extensions: [], isLoading: false })); // No extensions
    mockFetchPyroscopeDatasourceSettings();
  });

  it('should render without error', async () => {
    setup();

    expect(await screen.findByDisplayValue('process_cpu-cpu')).toBeDefined();
  });

  it('should render without error if empty profileTypes', async () => {
    const ds = setupDs();
    ds.getProfileTypes = jest.fn().mockResolvedValue([]);
    setup({
      props: {
        datasource: ds,
        query: {
          queryType: 'both',
          labelSelector: '',
          profileTypeId: '',
          refId: 'A',
          maxNodes: 1000,
          groupBy: [],
        },
      },
    });

    expect(await screen.findByPlaceholderText('No profile types found')).toBeDefined();
  });

  it('should render options', async () => {
    setup();
    await openOptions();
    expect(screen.getByText(/Metric/)).toBeDefined();
    expect(screen.getByText(/Profile/)).toBeDefined();
    expect(screen.getByText(/Both/)).toBeDefined();

    expect(screen.getByText(/Group by/)).toBeDefined();
  });

  it('should render correct options outside of explore', async () => {
    setup({ props: { app: CoreApp.Dashboard } });
    await openOptions();
    expect(screen.getByText(/Metric/)).toBeDefined();
    expect(screen.getByText(/Profile/)).toBeDefined();
    expect(screen.queryAllByText(/Both/).length).toBe(0);
  });
});

async function openOptions() {
  const options = screen.getByText(/Options/);
  expect(options).toBeDefined();
  await userEvent.click(options);
}

function setupDs() {
  const ds = new PyroscopeDataSource({
    name: 'test',
    uid: 'test',
    type: PluginType.datasource,
    access: 'proxy',
    id: 1,
    jsonData: {},
    meta: {
      name: '',
      id: '',
      type: PluginType.datasource,
      baseUrl: '',
      info: {
        author: {
          name: '',
        },
        description: '',
        links: [],
        logos: {
          large: '',
          small: '',
        },
        screenshots: [],
        updated: '',
        version: '',
      },
      module: '',
    },
    readOnly: false,
  });

  ds.getProfileTypes = jest.fn().mockResolvedValue([
    {
      label: 'process_cpu - cpu',
      id: 'process_cpu:cpu',
    },
    {
      label: 'memory',
      id: 'memory:memory',
    },
  ] as ProfileTypeMessage[]);

  ds.getLabelNames = jest.fn().mockResolvedValue(['label_one']);

  return ds;
}

function setup(options: { props: Partial<Props> } = { props: {} }) {
  const onChange = jest.fn();
  const utils = render(
    <QueryEditor
      query={{
        queryType: 'both',
        labelSelector: '',
        profileTypeId: 'process_cpu:cpu',
        refId: 'A',
        maxNodes: 1000,
        groupBy: [],
        limit: 42,
      }}
      datasource={setupDs()}
      onChange={onChange}
      onRunQuery={() => {}}
      app={CoreApp.Explore}
      {...options.props}
    />
  );
  return { ...utils, onChange };
}
