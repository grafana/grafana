import { screen, render, act } from '@testing-library/react';
import React from 'react';
import { Store } from 'redux';
import { TestProvider } from 'test/helpers/TestProvider';

import { LayoutModes } from '@grafana/data';
import { setAngularLoader } from '@grafana/runtime';
import config from 'app/core/config';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { configureStore } from 'app/store/configureStore';

import { navIndex, getMockDataSource, getMockDataSourceMeta, getMockDataSourceSettingsState } from '../__mocks__';
import * as api from '../api';
import { initialState } from '../state';

import { EditDataSourcePage } from './EditDataSourcePage';

jest.mock('../api');
jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasPermission: () => true,
    hasPermissionInMetadata: () => true,
  },
}));
jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    getDataSourceSrv: jest.fn(() => ({
      getInstanceSettings: (uid: string) => ({
        uid,
        meta: getMockDataSourceMeta(),
      }),
    })),
  };
});

const setup = (uid: string, store: Store) =>
  render(
    <TestProvider store={store}>
      <EditDataSourcePage
        {...getRouteComponentProps({
          // @ts-ignore
          match: {
            params: {
              uid,
            },
          },
        })}
      />
    </TestProvider>
  );

describe('<EditDataSourcePage>', () => {
  const uid = 'foo';
  const name = 'My DataSource';
  const dataSource = getMockDataSource<{}>({ uid, name });
  const dataSourceMeta = getMockDataSourceMeta();
  const dataSourceSettings = getMockDataSourceSettingsState();
  let store: Store;
  const topnavValue = config.featureToggles.topnav;

  beforeAll(() => {
    setAngularLoader({
      load: () => ({
        destroy: jest.fn(),
        digest: jest.fn(),
        getScope: () => ({ $watch: () => {} }),
      }),
    });
  });

  beforeEach(() => {
    // @ts-ignore
    api.getDataSourceByIdOrUid = jest.fn().mockResolvedValue(dataSource);

    store = configureStore({
      dataSourceSettings,
      dataSources: {
        ...initialState,
        dataSources: [dataSource],
        dataSource: dataSource,
        dataSourceMeta: dataSourceMeta,
        layoutMode: LayoutModes.Grid,
        isLoadingDataSources: false,
      },
      navIndex: {
        ...navIndex,
        [`datasource-settings-${uid}`]: {
          id: `datasource-settings-${uid}`,
          text: name,
          icon: 'list-ul',
          url: `/datasources/edit/${uid}`,
        },
      },
    });
  });

  afterAll(() => {
    config.featureToggles.topnav = topnavValue;
  });

  it('should render the edit page without an issue', async () => {
    config.featureToggles.topnav = false;
    setup(uid, store);

    expect(screen.queryByText('Loading ...')).not.toBeInTheDocument();

    // Title
    expect(screen.queryByText(name)).toBeVisible();

    // Buttons
    expect(screen.queryByRole('button', { name: /Back/i })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Delete/i })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Save (.*) test/i })).toBeVisible();
    expect(screen.queryByRole('link', { name: /Explore/i })).toBeVisible();

    // wait for the rest of the async processes to finish
    expect(await screen.findByText(name)).toBeVisible();
  });

  it('should show updated action buttons when topnav is on', () => {
    act(() => {
      config.featureToggles.topnav = true;
    });

    setup(uid, store);

    // Buttons
    expect(screen.queryAllByRole('button', { name: /Back/i })).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Delete/i })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Save (.*) test/i })).toBeVisible();
    expect(screen.queryByRole('link', { name: /Build a dashboard/i })).toBeVisible();
    expect(screen.queryAllByRole('link', { name: /Explore/i })).toHaveLength(2);
  });
});
