import { render, screen } from '@testing-library/react';
import React from 'react';
import { act } from 'react-dom/test-utils';

import { PluginType, rangeUtil, PluginExtensionLink, PluginExtensionTypes } from '@grafana/data';
import { getPluginLinkExtensions } from '@grafana/runtime';

import { PyroscopeDataSource } from '../datasource';
import { mockFetchPyroscopeDatasourceSettings } from '../datasource.test';

import { Props, PyroscopeQueryLinkExtensions, resetPyroscopeQueryLinkExtensionsFetches } from './QueryLinkExtension';

// Constants copied from `QueryLinkExtension.tsx`
const EXTENSION_POINT_ID = 'plugins/grafana-pyroscope-datasource/query-links';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  setPluginExtensionGetter: jest.fn(),
  getPluginLinkExtensions: jest.fn(),
  getTemplateSrv: () => {
    return {
      replace: (query: string): string => {
        return query.replace(/\$var/g, 'interpolated');
      },
    };
  },
}));

const getPluginLinkExtensionsMock = jest.mocked(getPluginLinkExtensions);

const defaultPyroscopeDataSourceSettings = {
  uid: 'default-pyroscope',
  url: 'http://pyroscope',
  basicAuthUser: 'pyroscope_user',
};

describe('PyroscopeQueryLinkExtensions', () => {
  const EXPECTED_BUTTON_LABEL = 'Profiles App';
  const DEFAULT_EXTENSION_PATH = 'a/mock-path-app/fake-path';

  function createExtension(overrides?: Partial<PluginExtensionLink>) {
    return {
      ...{
        description: 'unremarkable-description',
        extensionPointId: EXTENSION_POINT_ID,
        title: EXPECTED_BUTTON_LABEL,
        path: DEFAULT_EXTENSION_PATH,
        type: PluginExtensionTypes.link,
        category: 'unremarkable-category',
        icon: 'heart',
        onClick() {},
        pluginId: 'mock-path-app',
        id: `${Date.now()}}`,
      },
      ...overrides,
    } as PluginExtensionLink;
  }

  beforeEach(() => {
    resetPyroscopeQueryLinkExtensionsFetches();
    mockFetchPyroscopeDatasourceSettings(defaultPyroscopeDataSourceSettings);

    getPluginLinkExtensionsMock.mockRestore();
    getPluginLinkExtensionsMock.mockReturnValue({ extensions: [] }); // Unless stated otherwise, no extensions
  });

  it('should render if extension present', async () => {
    getPluginLinkExtensionsMock.mockReturnValue({ extensions: [createExtension()] }); // Default extension

    await act(setup);
    expect(await screen.findAllByText(EXPECTED_BUTTON_LABEL)).toBeDefined();
  });

  it('Should not render if no extension present', async () => {
    await act(setup);
    expect(screen.queryByText(EXPECTED_BUTTON_LABEL)).toBeNull();
  });
});

function setupDs() {
  const ds = new PyroscopeDataSource({
    ...defaultPyroscopeDataSourceSettings,
    name: 'test',
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

  return ds;
}

async function setup(options: { props: Partial<Props> } = { props: {} }) {
  const utils = render(
    <PyroscopeQueryLinkExtensions
      query={{
        queryType: 'both',
        labelSelector: '',
        profileTypeId: 'process_cpu:cpu',
        refId: 'A',
        maxNodes: 1000,
        groupBy: [],
      }}
      datasource={setupDs()}
      range={rangeUtil.convertRawToRange({ from: 'now-1h', to: 'now' })}
      {...options.props}
    />
  );
  return { ...utils };
}
