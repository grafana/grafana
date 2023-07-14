import { render, screen } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import React from 'react';
import { Route, Router } from 'react-router-dom';
import { Store } from 'redux';
import { TestProvider } from 'test/helpers/TestProvider';

import { setAngularLoader } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import * as api from '../../datasources/api';
import { initialState as dataSourcesInitialState } from '../../datasources/state';
import { navIndex, getMockDataSource } from '../__mocks__';

import { DataSourceDashboardsPage } from './DataSourceDashboardsPage';

jest.mock('../../datasources/api');
jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasPermission: () => true,
    hasPermissionInMetadata: () => true,
  },
}));

const setup = (uid: string, store: Store) => {
  const history = createMemoryHistory({ initialEntries: [`/datasources/edit/${uid}`] });

  return render(
    <TestProvider store={store}>
      <Router history={history}>
        <Route path="/datasources/edit/:uid">
          <DataSourceDashboardsPage />
        </Route>
      </Router>
    </TestProvider>
  );
};

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
