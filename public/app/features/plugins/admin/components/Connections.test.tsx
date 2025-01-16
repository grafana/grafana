import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';
import { getMockDataSources } from 'app/features/datasources/__mocks__';
import { AccessControlAction } from 'app/types';

import { datasourcePlugin } from '../__mocks__/catalogPlugin.mock';

import Connections from './Connections';

jest.mock('app/features/datasources/state', () => ({
  ...jest.requireActual('app/features/datasources/state'),
  useLoadDataSource: jest.fn().mockReturnValue({ isLoading: false }),
  getDataSources: jest.fn(() => 'getDataSources mock implementation'),
}));

const setupContextSrv = () => {
  const testContextSrv = new ContextSrv();
  testContextSrv.user.permissions = {
    [AccessControlAction.DataSourcesCreate]: true,
    [AccessControlAction.DataSourcesWrite]: true,
    [AccessControlAction.DataSourcesExplore]: true,
  };

  setContextSrv(testContextSrv);
};

describe('<Connections>', () => {
  const oldExporeEnabled = config.exploreEnabled;
  config.exploreEnabled = true;
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    config.exploreEnabled = oldExporeEnabled;
  });

  it('should onnly render list of datasources with type=plugin.id', async () => {
    setupContextSrv();
    const mockedConnections = getMockDataSources(3, { type: datasourcePlugin.id });
    mockedConnections[2].type = 'other-plugin-id';
    jest.requireMock('app/features/datasources/state').getDataSources.mockReturnValue(mockedConnections);

    render(<Connections plugin={datasourcePlugin} />);

    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
    expect(await screen.findAllByRole('heading')).toHaveLength(2);
    expect(await screen.findByRole('link', { name: /Connections - Data sources/i })).toBeVisible();
    expect(await screen.findAllByRole('link', { name: /Build a dashboard/i })).toHaveLength(2);
    expect(await screen.findAllByRole('link', { name: 'Explore' })).toHaveLength(2);
  });

  it('should render add new datasource button when no datasources are defined', async () => {
    setupContextSrv();
    jest.requireMock('app/features/datasources/state').getDataSources.mockReturnValue(getMockDataSources(1));
    render(<Connections plugin={datasourcePlugin} />);

    expect(screen.getByText('Add new data source')).toBeVisible();
    expect(screen.getByText(`No data sources defined`)).toBeVisible();
  });
});
