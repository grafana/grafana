import { render, screen } from '@testing-library/react';
import React from 'react';
import { Store } from 'redux';
import { TestProvider } from 'test/helpers/TestProvider';

import { setAngularLoader } from '@grafana/runtime';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { configureStore } from 'app/store/configureStore';

import { navIndex, getMockDataSource } from '../__mocks__';
import * as api from '../api';
import { initialState as dataSourcesInitialState } from '../state';

import DataSourceDashboardsPage from './DataSourceDashboardsPage';

jest.mock('../api');
jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasPermission: () => true,
    hasPermissionInMetadata: () => true,
  },
}));

const setup = (uid: string, store: Store) =>
  render(
    <TestProvider store={store}>
      <DataSourceDashboardsPage
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

describe('<DataSourceDashboardsPage>', () => {
  const uid = 'foo';
  const dataSourceName = 'My DataSource';
  const dataSource = getMockDataSource<{}>({ uid, name: dataSourceName });
  let store: Store;

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
      dataSources: {
        ...dataSourcesInitialState,
        dataSource: dataSource,
      },
      navIndex: {
        ...navIndex,
        [`datasource-dashboards-${uid}`]: {
          id: `datasource-dashboards-${uid}`,
          text: dataSourceName,
          icon: 'list-ul',
          url: `/datasources/edit/${uid}/dashboards`,
        },
      },
    });
  });

  it('should render the dashboards page without an issue', () => {
    setup(uid, store);

    expect(screen.queryByText(dataSourceName)).toBeVisible();
  });
});
