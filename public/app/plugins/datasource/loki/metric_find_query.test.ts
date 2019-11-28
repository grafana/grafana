import { processMetricFindQuery } from './metric_find_query';
import { makeMockLokiDatasource } from './mocks';
import LokiDatasource from './datasource';

describe('processMetricFindQuery', () => {
  makeMocks().forEach((mock, index) => {
    it(`should return label names for Loki v${index}`, async () => {
      const query = 'label_names()';
      const res = await processMetricFindQuery(mock, query);
      expect(res[0].text).toEqual('label1');
      expect(res[1].text).toEqual('label2');
      expect(res.length).toBe(2);
    });
  });

  makeMocks().forEach((mock, index) => {
    it(`should return label values for Loki v${index}`, async () => {
      const query = 'label_values(label1)';
      const res = await processMetricFindQuery(mock, query);
      expect(res[0].text).toEqual('value1');
      expect(res[1].text).toEqual('value2');
      expect(res.length).toBe(2);
    });
  });

  makeMocks().forEach((mock, index) => {
    it(`should return empty array when incorrect query for Loki v${index}`, async () => {
      const query = 'incorrect_query';
      const res = await processMetricFindQuery(mock, query);
      expect(res.length).toBe(0);
    });
  });
});

function makeMocks() {
  let mocks = [];
  for (let i = 0; i <= 1; i++) {
    let mock: LokiDatasource = makeMockLokiDatasource({ label1: ['value1', 'value2'], label2: ['value3', 'value4'] });
    mock.getVersion = jest.fn().mockReturnValue(`v${i}`);
    mocks.push(mock);
  }
  return mocks;
}
