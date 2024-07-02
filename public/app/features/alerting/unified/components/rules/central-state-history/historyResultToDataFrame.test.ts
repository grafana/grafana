import {
  getHistoryResponse,
  time_0,
  time_plus_10,
  time_plus_15,
  time_plus_30,
  time_plus_5,
} from '../../../mocks/grafanaRulerApi';

import { historyResultToDataFrame } from './utils';

describe('historyResultToDataFrame', () => {
  it('should return correct result grouping by 10 seconds', async () => {
    const result = historyResultToDataFrame(getHistoryResponse([time_0, time_0, time_plus_30, time_plus_30]));
    expect(result[0].length).toBe(2);
    expect(result[0].fields[0].name).toBe('time');
    expect(result[0].fields[1].name).toBe('value');
    expect(result[0].fields[0].values).toStrictEqual([time_0, time_plus_30]);
    expect(result[0].fields[1].values).toStrictEqual([2, 2]);

    const result2 = historyResultToDataFrame(getHistoryResponse([time_0, time_plus_5, time_plus_30, time_plus_30]));
    expect(result2[0].length).toBe(2);
    expect(result2[0].fields[0].name).toBe('time');
    expect(result2[0].fields[1].name).toBe('value');
    expect(result2[0].fields[0].values).toStrictEqual([time_0, time_plus_30]);
    expect(result2[0].fields[1].values).toStrictEqual([2, 2]);

    const result3 = historyResultToDataFrame(getHistoryResponse([time_0, time_plus_15, time_plus_10, time_plus_30]));
    expect(result3[0].length).toBe(3);
    expect(result3[0].fields[0].name).toBe('time');
    expect(result3[0].fields[1].name).toBe('value');
    expect(result3[0].fields[0].values).toStrictEqual([time_0, time_plus_10, time_plus_30]);
    expect(result3[0].fields[1].values).toStrictEqual([1, 2, 1]);
  });
});
