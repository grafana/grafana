import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { NestedScene, SceneFlexItem, SceneFlexLayout } from '@grafana/scenes';

import { mockDataSource } from '../mocks';

import { getInsightsScenes, insightsIsAvailable } from './Insights';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: jest.fn(),
}));

const getDataSourceInstanceSettingsMock = jest.mocked(getDataSourceInstanceSettings);

const CLOUD_USAGE_UID = 'grafanacloud-usage';
const ALERT_STATE_HISTORY_UID = 'grafanacloud-alert-state-history';
const CLOUD_PROM_UID = 'grafanacloud-prom';

function setupAvailableDataSources(...uids: string[]) {
  getDataSourceInstanceSettingsMock.mockImplementation(async (ref) =>
    typeof ref === 'string' && uids.includes(ref) ? mockDataSource({ uid: ref }) : undefined
  );
}

async function getCategoryTitles() {
  const body = (await getInsightsScenes()).state.body;
  if (!(body instanceof SceneFlexLayout)) {
    throw new Error('Expected the insights scene body to be a SceneFlexLayout');
  }
  return body.state.children.map((child) =>
    child instanceof SceneFlexItem && child.state.body instanceof NestedScene ? child.state.body.state.title : undefined
  );
}

describe('insightsIsAvailable', () => {
  it('resolves to true when the cloud usage data source exists', async () => {
    setupAvailableDataSources(CLOUD_USAGE_UID);

    await expect(insightsIsAvailable()).resolves.toBe(true);
    expect(getDataSourceInstanceSettingsMock).toHaveBeenCalledWith(CLOUD_USAGE_UID);
  });

  it('resolves to false when the cloud usage data source is missing', async () => {
    setupAvailableDataSources(ALERT_STATE_HISTORY_UID, CLOUD_PROM_UID);

    await expect(insightsIsAvailable()).resolves.toBe(false);
  });
});

describe('getInsightsScenes', () => {
  it('builds every category once all data sources resolve', async () => {
    setupAvailableDataSources(CLOUD_USAGE_UID, ALERT_STATE_HISTORY_UID, CLOUD_PROM_UID);

    await expect(getCategoryTitles()).resolves.toEqual([
      'Grafana-managed alert rules',
      'Grafana Alertmanager',
      'Mimir-managed alert rules',
      'Mimir-managed alert rules - per rule group',
      'Mimir Alertmanager',
    ]);
  });

  it('omits the categories whose data sources are missing', async () => {
    setupAvailableDataSources(CLOUD_USAGE_UID);

    await expect(getCategoryTitles()).resolves.toEqual([
      'Grafana Alertmanager',
      'Mimir-managed alert rules - per rule group',
      'Mimir Alertmanager',
    ]);
  });

  it('builds no categories when no data source resolves', async () => {
    setupAvailableDataSources();

    await expect(getCategoryTitles()).resolves.toEqual([]);
  });
});
