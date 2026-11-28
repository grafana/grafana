import { useAsync } from 'react-use';
import { of } from 'rxjs';
import { act, render, screen } from 'test/test-utils';

import { DataSourceApi, type DataSourceInstanceListItem, DataSourcePlugin, LoadingState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { config, setPluginImportUtils, setRunRequest, useDataSourceInstanceListItem } from '@grafana/runtime';
import { pluginImporter } from 'app/features/plugins/importer/pluginImporter';

import { setupMswServer } from '../mockApi';
import { mockDataSource } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';
import { DataSourceType } from '../utils/datasource';

import Home from './Home';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return { ...actual, useDataSourceInstanceListItem: jest.fn(actual.useDataSourceInstanceListItem) };
});

const { useDataSourceInstanceListItem: realUseDataSourceInstanceListItem, getDataSourceInstanceListItem } =
  jest.requireActual('@grafana/runtime');

setupMswServer();

const ashDs = mockDataSource(
  { uid: 'grafanacloud-alert-state-history', name: 'Alert state history', type: DataSourceType.Loki },
  { id: DataSourceType.Loki }
);
const cloudUsageDs = mockDataSource({ uid: 'grafanacloud-usage', name: 'Cloud usage' });
const cloudPromDs = mockDataSource({ uid: 'grafanacloud-prom', name: 'Cloud Prometheus' });

const SECTION = {
  grafanaManaged: 'Grafana-managed alert rules',
  grafanaAlertmanager: 'Grafana Alertmanager',
  mimirManaged: 'Mimir-managed alert rules',
  mimirPerGroup: 'Mimir-managed alert rules - per rule group',
  mimirAlertmanager: 'Mimir Alertmanager',
};

// The Insights panels load panel plugins and query their data sources. These stubs answer with empty panels and no data.
setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});
setRunRequest(() => of({ state: LoadingState.Done, series: [], timeRange: {} as never }));

class EmptyDataSource extends DataSourceApi {
  query() {
    return Promise.resolve({ data: [] });
  }
  metricFindQuery() {
    return Promise.resolve([]);
  }
  testDatasource() {
    return Promise.resolve({ status: 'success', message: '' });
  }
}

const originalEnv = config.buildInfo.env;

// Routes one uid through a custom lookup and leaves the others on the real hook.
function overrideLookup(uid: string, lookup: () => Promise<DataSourceInstanceListItem | undefined>) {
  jest.mocked(useDataSourceInstanceListItem).mockImplementation((ref) => {
    if (ref !== uid) {
      return realUseDataSourceInstanceListItem(ref);
    }
    // eslint-disable-next-line react-hooks/rules-of-hooks -- the branch is fixed per call site
    const { loading, error, value } = useAsync(lookup, []);
    return { isLoading: loading, error, item: value };
  });
}

beforeEach(() => {
  config.buildInfo.env = 'production';
  jest
    .spyOn(pluginImporter, 'importDataSource')
    .mockResolvedValue(new DataSourcePlugin<DataSourceApi>(EmptyDataSource));
});

afterEach(() => {
  config.buildInfo.env = originalEnv;
  jest.mocked(useDataSourceInstanceListItem).mockImplementation(realUseDataSourceInstanceListItem);
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('Alerting home', () => {
  it('hides the Insights tab and opens Get started when grafanacloud-usage does not exist', async () => {
    setupDataSources(ashDs, cloudPromDs);
    render(<Home />);

    expect(await screen.findByRole('tab', { name: 'Get started', selected: true })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Insights' })).not.toBeInTheDocument();
  });

  it('opens the Insights tab by default when grafanacloud-usage exists', async () => {
    setupDataSources(cloudUsageDs);
    render(<Home />);

    expect(await screen.findByRole('tab', { name: 'Insights', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Get started', selected: false })).toBeInTheDocument();
  });

  it.each([
    {
      name: 'usage only',
      dataSources: [cloudUsageDs],
      shown: [SECTION.grafanaAlertmanager, SECTION.mimirPerGroup, SECTION.mimirAlertmanager],
      hidden: [SECTION.grafanaManaged, SECTION.mimirManaged],
    },
    {
      name: 'usage and alert state history',
      dataSources: [cloudUsageDs, ashDs],
      shown: [SECTION.grafanaManaged, SECTION.grafanaAlertmanager],
      hidden: [SECTION.mimirManaged],
    },
    {
      name: 'usage and cloud Prometheus',
      dataSources: [cloudUsageDs, cloudPromDs],
      shown: [SECTION.mimirManaged, SECTION.mimirAlertmanager],
      hidden: [SECTION.grafanaManaged],
    },
  ])('shows only the sections whose data sources exist: $name', async ({ dataSources, shown, hidden }) => {
    setupDataSources(...dataSources);
    render(<Home />);

    for (const title of shown) {
      expect(await screen.findByText(title)).toBeInTheDocument();
    }
    for (const title of hidden) {
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    }
  });

  it('shows the resolved data source names in the section subheaders', async () => {
    setupDataSources(cloudUsageDs, cloudPromDs);
    render(<Home />);

    expect(await screen.findByText(SECTION.mimirManaged)).toBeInTheDocument();
    // Mimir-managed lists prom + usage; per-group and Mimir Alertmanager list usage.
    expect(screen.getAllByText('Cloud Prometheus')).toHaveLength(1);
    expect(screen.getAllByText('Cloud usage')).toHaveLength(3);
  });

  it('keeps the tab the user picked', async () => {
    setupDataSources(cloudUsageDs);
    const { user } = render(<Home />);

    await user.click(await screen.findByRole('tab', { name: 'Get started' }));

    expect(screen.getByRole('tab', { name: 'Get started', selected: true })).toBeInTheDocument();
    expect(screen.queryByText(SECTION.grafanaAlertmanager)).not.toBeInTheDocument();
  });

  it('shows a skeleton after 300 ms of loading, then the tabs once the data sources resolve', async () => {
    jest.useFakeTimers();
    setupDataSources(cloudUsageDs);
    let finishLookup!: () => void;
    const held = new Promise<void>((resolve) => (finishLookup = resolve));
    overrideLookup(cloudUsageDs.uid, async () => {
      await held;
      return getDataSourceInstanceListItem(cloudUsageDs.uid);
    });
    render(<Home />);

    await act(() => jest.advanceTimersByTimeAsync(299));
    expect(screen.queryByTestId('alerting-home-tabs-skeleton')).not.toBeInTheDocument();

    await act(() => jest.advanceTimersByTimeAsync(1));
    expect(screen.getByTestId('alerting-home-tabs-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();

    await act(async () => finishLookup());
    expect(await screen.findByRole('tab', { name: 'Insights', selected: true })).toBeInTheDocument();
    expect(screen.queryByTestId('alerting-home-tabs-skeleton')).not.toBeInTheDocument();
  });

  it('treats a failed lookup as a missing data source', async () => {
    setupDataSources(cloudUsageDs, cloudPromDs);
    overrideLookup(cloudPromDs.uid, () => Promise.reject(new Error('lookup failed')));
    render(<Home />);

    expect(await screen.findByText(SECTION.mimirAlertmanager)).toBeInTheDocument();
    expect(screen.queryByText(SECTION.mimirManaged)).not.toBeInTheDocument();
  });
});
