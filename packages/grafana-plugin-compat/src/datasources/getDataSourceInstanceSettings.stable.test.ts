import { type DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceInstanceSettings as stableGetDataSourceInstanceSettings } from '@grafana/runtime';
import { getDataSourceInstanceSettings as unstableGetDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { getDataSourceInstanceSettings } from './getDataSourceInstanceSettings';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstanceSettings: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: jest.fn(),
}));

const mockStableGetDataSourceInstanceSettings = jest.mocked(stableGetDataSourceInstanceSettings);
const mockUnstableGetDataSourceInstanceSettings = jest.mocked(unstableGetDataSourceInstanceSettings);
const mockData = { uid: 'ds-logs', type: 'loki', name: 'Loki' } as DataSourceInstanceSettings;

describe('getDataSourceInstanceSettings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableGetDataSourceInstanceSettings.mockResolvedValue(mockData);
  });

  it('should prefer the stable export over the unstable one', async () => {
    const result = await getDataSourceInstanceSettings('ds-logs', { var: { text: 'some-var', value: 0 } });

    expect(mockStableGetDataSourceInstanceSettings).toHaveBeenCalledWith('ds-logs', {
      var: { text: 'some-var', value: 0 },
    });
    expect(mockUnstableGetDataSourceInstanceSettings).not.toHaveBeenCalled();
    expect(result).toStrictEqual(mockData);
  });
});
