import { createLokiDatasource, createMetadataRequest } from './mocks';
import { LokiVariableQueryType } from './types';
import { LokiVariableSupport } from './variables';

describe('LokiVariableSupport', () => {
  let lokiVariableSupport: LokiVariableSupport;

  beforeEach(() => {
    const datasource = createLokiDatasource();
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
    const response = await lokiVariableSupport.execute({ refId: 'test', type: LokiVariableQueryType.LabelNames });

    expect(response).toEqual([{ text: 'label1' }, { text: 'label2' }]);
  });

  it('should return label values for Loki when no matcher', async () => {
    // label_values(label1)
    const response = await lokiVariableSupport.execute({
      refId: 'test',
      type: LokiVariableQueryType.LabelValues,
      label: 'label1',
    });

    expect(response).toEqual([{ text: 'value1' }, { text: 'value2' }]);
  });

  it('should return label values for Loki with matcher', async () => {
    // label_values({label1="value1", label2="value2"},label5)
    const response = await lokiVariableSupport.execute({
      refId: 'test',
      type: LokiVariableQueryType.LabelValues,
      stream: '{label1="value1", label2="value2"}',
      label: 'label5',
    });

    expect(response).toEqual([{ text: 'value5' }]);
  });
});
