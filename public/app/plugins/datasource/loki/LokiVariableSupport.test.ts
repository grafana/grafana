import { firstValueFrom } from 'rxjs';

import { dateTime, getDefaultTimeRange } from '@grafana/data';

import { LokiVariableSupport } from './LokiVariableSupport';
import { LokiDatasource } from './datasource';
import { createLokiDatasource } from './mocks/datasource';
import { createMetadataRequest } from './mocks/metadataRequest';
import { LokiVariableQueryType } from './types';

describe('LokiVariableSupport', () => {
  let lokiVariableSupport: LokiVariableSupport;
  let datasource: LokiDatasource;

  beforeEach(() => {
    datasource = createLokiDatasource();
    jest
      .spyOn(datasource, 'metadataRequest')
      .mockImplementation(
        createMetadataRequest(
          { label1: ['value1', 'value2'], label2: ['value3', 'value4'] },
          { '{label1="value1", label2="value2"}': [{ label5: 'value5' }] }
        )
      );

    lokiVariableSupport = new LokiVariableSupport(datasource);
  });

  it('should return label names for Loki', async () => {
    // label_names()
    const response = await lokiVariableSupport.execute(
      { refId: 'test', type: LokiVariableQueryType.LabelNames },
      {},
      getDefaultTimeRange()
    );

    expect(response).toEqual([{ text: 'label1' }, { text: 'label2' }]);
  });

  it('should return label values for Loki when no matcher', async () => {
    // label_values(label1)
    const response = await lokiVariableSupport.execute(
      {
        refId: 'test',
        type: LokiVariableQueryType.LabelValues,
        label: 'label1',
      },
      {},
      getDefaultTimeRange()
    );

    expect(response).toEqual([{ text: 'value1' }, { text: 'value2' }]);
  });

  it('should return label values for Loki with matcher', async () => {
    // label_values({label1="value1", label2="value2"},label5)
    const response = await lokiVariableSupport.execute(
      {
        refId: 'test',
        type: LokiVariableQueryType.LabelValues,
        stream: '{label1="value1", label2="value2"}',
        label: 'label5',
      },
      {},
      getDefaultTimeRange()
    );

    expect(response).toEqual([{ text: 'value5' }]);
  });

  it('should call `metricFindQuery` with the correct parameters', async () => {
    // label_values({label1="value1", label2="value2"},label5)
    const spy = jest.spyOn(datasource, 'metricFindQuery');
    const range = getDefaultTimeRange();
    const scopedVars = { foo: { value: 'bar' } };
    range.from = dateTime(new Date('2020-01-01T00:00:00Z'));
    range.to = dateTime(new Date('2020-01-01T01:00:00Z'));
    await firstValueFrom(
      lokiVariableSupport.query({
        targets: [
          {
            refId: 'test',
            type: LokiVariableQueryType.LabelValues,
            stream: '{label1="value1", label2="value2"}',
            label: 'label5',
          },
        ],
        range,
        scopedVars,
        requestId: 'test',
        interval: '1m',
        intervalMs: 60000,
        timezone: 'utc',
        app: 'explore',
        startTime: 0,
      })
    );

    expect(spy).toHaveBeenCalledWith(
      {
        refId: 'test',
        type: LokiVariableQueryType.LabelValues,
        stream: '{label1="value1", label2="value2"}',
        label: 'label5',
      },
      {
        range,
        scopedVars,
      }
    );

    spy.mockRestore();
  });
});
