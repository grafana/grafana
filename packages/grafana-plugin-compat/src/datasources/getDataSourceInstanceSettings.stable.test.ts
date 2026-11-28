import { type DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceInstanceSettings as stableGetDataSourceInstanceSettings } from '@grafana/runtime';

import { getDataSourceInstanceSettings } from './getDataSourceInstanceSettings';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstanceSettings: jest.fn(),
}));

const mockStableGetDataSourceInstanceSettings = jest.mocked(stableGetDataSourceInstanceSettings);
const mockData = { uid: 'ds-logs', type: 'loki', name: 'Loki' } as DataSourceInstanceSettings;

describe('getDataSourceInstanceSettings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockStableGetDataSourceInstanceSettings.mockResolvedValue(mockData);
  });

  it('should call the stable export', async () => {
    const result = await getDataSourceInstanceSettings('ds-logs', { var: { text: 'some-var', value: 0 } });

    expect(mockStableGetDataSourceInstanceSettings).toHaveBeenCalledWith('ds-logs', {
      var: { text: 'some-var', value: 0 },
    });
    expect(result).toStrictEqual(mockData);
  });
});
