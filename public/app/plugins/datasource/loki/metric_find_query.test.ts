import { processMetricFindQuery } from './metric_find_query';
import { makeMockLokiDatasource } from './mocks';
import LokiDatasource from './datasource';

describe('processMetricFindQuery', () => {
  let ds: LokiDatasource;
  beforeEach(() => {
    ds = makeMockLokiDatasource({ label1: ['value1', 'value2'], label2: ['value3', 'value4'] });
  });

  it('should return label names', async () => {
    const query = 'label_names()';
    const res = await processMetricFindQuery(ds, query);
    expect(res.length).toBe(2);
    expect(res[0].text).toEqual('label1');
    expect(res[1].text).toEqual('label2');
  });

  it('should return label values', async () => {
    const query = 'label_values(label1)';
    const res = await processMetricFindQuery(ds, query);
    expect(res.length).toBe(2);
    expect(res[0].text).toEqual('value1');
    expect(res[1].text).toEqual('value2');
  });

  it('should return empty array when incorrect query', async () => {
    const query = 'incorrect_query';
    const res = await processMetricFindQuery(ds, query);
    expect(res.length).toBe(0);
  });
});
