import { type DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime';
import { type NestedScene, type SceneFlexItem, type SceneFlexLayout, type SceneReactObject } from '@grafana/scenes';

import { getInsightsScenes, insightsIsAvailable } from './Insights';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstanceSettings: jest.fn(),
}));

const getDataSourceInstanceSettingsMock = jest.mocked(getDataSourceInstanceSettings);

function mockDataSource(uid: string): DataSourceInstanceSettings {
  return {
    uid,
    name: uid,
    type: 'prometheus',
  } as DataSourceInstanceSettings;
}

describe('getInsightsScenes', () => {
  beforeEach(() => {
    getDataSourceInstanceSettingsMock.mockReset();
  });

  it('loads the expected data sources through the async settings API', async () => {
    getDataSourceInstanceSettingsMock.mockImplementation(async (ref) => mockDataSource(String(ref)));

    await expect(insightsIsAvailable()).resolves.toEqual(expect.objectContaining({ uid: 'grafanacloud-usage' }));

    expect(getDataSourceInstanceSettingsMock).toHaveBeenCalledWith('grafanacloud-alert-state-history');
    expect(getDataSourceInstanceSettingsMock).toHaveBeenCalledWith('grafanacloud-usage');
    expect(getDataSourceInstanceSettingsMock).toHaveBeenCalledWith('grafanacloud-prom');
  });

  it('passes resolved data-source settings to section headers', async () => {
    const settingsByUid = new Map(
      ['grafanacloud-alert-state-history', 'grafanacloud-usage', 'grafanacloud-prom'].map((uid) => [
        uid,
        mockDataSource(uid),
      ])
    );
    getDataSourceInstanceSettingsMock.mockImplementation(async (ref) => settingsByUid.get(String(ref)));

    const scene = await getInsightsScenes();
    const body = scene.state.body as SceneFlexLayout;
    const cloudSection = body.state.children[body.state.children.length - 1] as SceneFlexItem;
    const cloudScene = cloudSection.state.body as NestedScene;
    const headerItem = cloudScene.state.body.state.children[0] as SceneFlexItem;
    const header = headerItem.state.body as SceneReactObject;

    expect(header.state.props).toMatchObject({
      datasources: [expect.objectContaining({ settings: settingsByUid.get('grafanacloud-usage') })],
    });
  });
});
