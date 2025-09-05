import { lastValueFrom } from 'rxjs';

import { DataQueryRequest, TimeRange } from '@grafana/data';

import { TempoVariableQuery } from './VariableQueryEditor';
import { createMetadataRequest, createTempoDatasource } from './test/mocks';
import { TempoVariableSupport } from './variables';

describe('TempoVariableSupport', () => {
  let TempoVariableSupportMock: TempoVariableSupport;

  beforeEach(() => {
    const datasource = createTempoDatasource();
    // Mock the language provider to return v2 tags
    datasource.languageProvider.tagsV2 = [{ name: 'span', tags: ['label1', 'label2'] }];
    jest.spyOn(datasource.languageProvider, 'start').mockResolvedValue([]);
    TempoVariableSupportMock = new TempoVariableSupport(datasource);
  });

  it('should return label names for Tempo', async () => {
    const response = TempoVariableSupportMock.query({
      app: 'undefined',
      startTime: 0,
      requestId: '1',
      interval: 'undefined',
      scopedVars: {},
      timezone: 'undefined',
      type: 0,
      maxDataPoints: 10,
      intervalMs: 5000,
      targets: [
        {
          refId: 'A',
          datasource: { uid: 'GRAFANA_DATASOURCE_NAME', type: 'sample' },
          type: 0,
        },
      ],
      panelId: 1,
      publicDashboardAccessToken: '',
      range: { from: new Date().toLocaleString(), to: new Date().toLocaleString() } as unknown as TimeRange,
    } as DataQueryRequest<TempoVariableQuery>);

    const data = (await lastValueFrom(response)).data;
    expect(data).toEqual([{ text: 'label1' }, { text: 'label2' }]);
  });
});
