import { type DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceInstanceSettings as rtGetDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { getDataSourceInstanceSettings } from './getDataSourceInstanceSettings';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: jest.fn(),
}));

const mockRuntimeGetDataSourceInstanceSettings = jest.mocked(rtGetDataSourceInstanceSettings);
const mockData = { uid: 'ds-logs', type: 'loki', name: 'Loki' } as DataSourceInstanceSettings;

describe('getDataSourceInstanceSettings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRuntimeGetDataSourceInstanceSettings.mockResolvedValue(mockData);
  });

  it('should call correct function when getDataSourceInstanceSettings exists', async () => {
    await getDataSourceInstanceSettings('ds-logs', { var: { text: 'some-var', value: 0 } });

    expect(mockRuntimeGetDataSourceInstanceSettings).toHaveBeenCalled();
    expect(mockRuntimeGetDataSourceInstanceSettings).toHaveBeenCalledWith('ds-logs', {
      var: { text: 'some-var', value: 0 },
    });
  });

  it('should return correct response when getDataSourceInstanceSettings exists', async () => {
    const result = await getDataSourceInstanceSettings('ds-logs', { var: { text: 'some-var', value: 0 } });

    expect(result).toStrictEqual(mockData);
  });
});
