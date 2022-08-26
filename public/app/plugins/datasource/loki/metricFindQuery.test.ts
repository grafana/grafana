import { TemplateSrv } from 'app/features/templating/template_srv';

import { LokiMetricFindQuery } from './metricFindQuery';
import { createLokiDatasource, createMetadataRequest } from './mocks';
import { LokiVariableQueryType } from './types';

describe('LokiMetricFindQuery', () => {
  let lokiMetricFindQuery: LokiMetricFindQuery;

  beforeEach(() => {
    const datasource = createLokiDatasource({} as unknown as TemplateSrv);
    jest
      .spyOn(datasource, 'metadataRequest')
      .mockImplementation(
        createMetadataRequest(
          { label1: ['value1', 'value2'], label2: ['value3', 'value4'] },
          { '{label1="value1", label2="value2"}': [{ label5: 'value5' }] }
        )
      );

    lokiMetricFindQuery = new LokiMetricFindQuery(datasource);
  });

  it('should return label names for Loki', async () => {
    // label_names()
    const response = await lokiMetricFindQuery.execute({ refId: 'test', type: LokiVariableQueryType.labelNames });

    expect(response).toEqual([{ text: 'label1' }, { text: 'label2' }]);
  });

  it('should return label values for Loki when no matcher', async () => {
    // label_values(label1)
    const response = await lokiMetricFindQuery.execute({
      refId: 'test',
      type: LokiVariableQueryType.labelValues,
      label: 'label1',
    });

    expect(response).toEqual([{ text: 'value1' }, { text: 'value2' }]);
  });

  it('should return label values for Loki with matcher', async () => {
    // label_values({label1="value1", label2="value2"},label5)
    const response = await lokiMetricFindQuery.execute({
      refId: 'test',
      type: LokiVariableQueryType.labelValues,
      stream: '{label1="value1", label2="value2"}',
      label: 'label5',
    });

    expect(response).toEqual([{ text: 'value5' }]);
  });
});
