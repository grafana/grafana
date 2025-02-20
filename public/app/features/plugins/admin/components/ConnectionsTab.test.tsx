import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { DataSourceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ContextSrv, setContextSrv } from 'app/core/services/context_srv';
import { getMockDataSources } from 'app/features/datasources/__mocks__';
import { AccessControlAction } from 'app/types';

import { datasourcePlugin } from '../__mocks__/catalogPlugin.mock';

import ConnectionsTab, { ConnectionsList } from './ConnectionsTab';

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

describe('<ConnectionsTab>', () => {
  const oldExporeEnabled = config.exploreEnabled;
  const olddatasourceConnectionsTab = config.featureToggles.datasourceConnectionsTab;
  config.exploreEnabled = true;
  config.featureToggles.datasourceConnectionsTab = true;
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    config.exploreEnabled = oldExporeEnabled;
    config.featureToggles.datasourceConnectionsTab = olddatasourceConnectionsTab;
  });

  it('should onnly render list of datasources with type=plugin.id', async () => {
    setupContextSrv();
    const mockedConnections = getMockDataSources(3, { type: datasourcePlugin.id });
    mockedConnections[2].type = 'other-plugin-id';
    jest.requireMock('app/features/datasources/state').getDataSources.mockReturnValue(mockedConnections);

    render(<ConnectionsTab plugin={datasourcePlugin} />);

    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
    expect(await screen.findAllByRole('heading')).toHaveLength(2);
    expect(await screen.findByRole('link', { name: /Connections - Data sources/i })).toBeVisible();
    expect(await screen.findAllByRole('link', { name: /Build a dashboard/i })).toHaveLength(2);
    expect(await screen.findAllByRole('link', { name: 'Explore' })).toHaveLength(2);
  });

  it('should render add new datasource button when no datasources are defined', async () => {
    setupContextSrv();
    jest.requireMock('app/features/datasources/state').getDataSources.mockReturnValue(getMockDataSources(1));
    render(<ConnectionsTab plugin={datasourcePlugin} />);

    expect(screen.getByText('Add new data source')).toBeVisible();
    expect(screen.getByText(`No data sources defined`)).toBeVisible();
  });

  describe('<ConnectionsList>', () => {
    it('should render list of datasources', async () => {
      const dss = getMockDataSources(2, { type: datasourcePlugin.id });
      render(
        <ConnectionsList
          plugin={datasourcePlugin}
          hasExploreRights={true}
          isLoading={false}
          hasWriteRights={true}
          dataSources={dss}
          dataSourcesCount={dss.length}
        />
      );

      expect(await screen.findAllByRole('listitem')).toHaveLength(2);
      expect(await screen.findAllByRole('heading')).toHaveLength(2);
      expect(await screen.findByRole('link', { name: /Connections - Data sources/i })).toBeVisible();
      expect(await screen.findAllByRole('link', { name: /Build a dashboard/i })).toHaveLength(2);
      expect(await screen.findAllByRole('link', { name: 'Explore' })).toHaveLength(2);
    });

    it('should not render Explore button when user has no access', async () => {
      const dss = getMockDataSources(2, { type: datasourcePlugin.id });
      render(
        <ConnectionsList
          plugin={datasourcePlugin}
          hasExploreRights={false}
          isLoading={false}
          hasWriteRights={true}
          dataSources={dss}
          dataSourcesCount={dss.length}
        />
      );

      expect(await screen.findAllByRole('listitem')).toHaveLength(2);
      expect(await screen.findAllByRole('heading')).toHaveLength(2);
      expect(await screen.findByRole('link', { name: /Connections - Data sources/i })).toBeVisible();
      expect(await screen.findAllByRole('link', { name: /Build a dashboard/i })).toHaveLength(2);
      expect(screen.queryAllByRole('link', { name: 'Explore' })).toHaveLength(0);
    });

    it('should render add new datasource button when no datasources are defined', async () => {
      const dss = [] as DataSourceSettings[];
      render(
        <ConnectionsList
          plugin={datasourcePlugin}
          hasExploreRights={true}
          isLoading={false}
          hasWriteRights={true}
          dataSources={dss}
          dataSourcesCount={dss.length}
        />
      );

      expect(screen.getByText('Add new data source')).toBeVisible();
      expect(screen.getByText(`No data sources defined`)).toBeVisible();
    });
  });
});
