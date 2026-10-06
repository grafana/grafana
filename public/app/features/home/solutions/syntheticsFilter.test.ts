import { type DataSourceApi } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime/unstable';

import { fetchSyntheticsLabelValues, parseSyntheticsFilter } from './syntheticsFilter';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
}));

const mockGetDataSourceInstance = jest.mocked(getDataSourceInstance);
const getTagValues = jest.fn();

const stored = {
  datasourceUid: 'uid-a',
  datasourceName: 'Prometheus',
  jobs: ['canary'],
  instances: ['https://shop.example'],
  probes: ['Amsterdam'],
};

beforeEach(() => {
  getTagValues.mockReset();
  mockGetDataSourceInstance.mockReset();
  mockGetDataSourceInstance.mockResolvedValue({ getTagValues } as unknown as DataSourceApi);
});

describe('parseSyntheticsFilter', () => {
  it('reads a missing, malformed or wrongly shaped value as every check counting', () => {
    expect(parseSyntheticsFilter(undefined)).toBeNull();
    expect(parseSyntheticsFilter('{not json')).toBeNull();
    expect(parseSyntheticsFilter(JSON.stringify({ ...stored, jobs: 'canary' }))).toBeNull();
  });

  it('trims values, drops blank entries and reads what is left empty as every check counting', () => {
    expect(
      parseSyntheticsFilter(JSON.stringify({ ...stored, jobs: ['', ' canary '], instances: [' '], probes: [] }))
    ).toEqual({ ...stored, jobs: ['canary'], instances: [], probes: [] });
    expect(parseSyntheticsFilter(JSON.stringify({ ...stored, jobs: [''], instances: [' '], probes: [] }))).toBeNull();
  });
});

describe('fetchSyntheticsLabelValues', () => {
  it('asks the datasource for the label values carried by sm_check_info, unnarrowed', async () => {
    getTagValues.mockResolvedValue([{ text: 'canary', value: 'canary' }]);

    await expect(fetchSyntheticsLabelValues('uid-a', 'job')).resolves.toEqual(['canary']);

    expect(mockGetDataSourceInstance).toHaveBeenCalledWith({ uid: 'uid-a' });
    expect(getTagValues).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'job',
        filters: [],
        queries: [{ refId: 'values', expr: 'sm_check_info' }],
      })
    );
  });

  it('reads as empty when the datasource cannot list label values', async () => {
    mockGetDataSourceInstance.mockResolvedValue({} as DataSourceApi);

    await expect(fetchSyntheticsLabelValues('uid-c', 'probe')).resolves.toEqual([]);
  });
});
