import { getRangeChunks } from './logsTimeSplit';

describe('querySplit', () => {
  it('should split time range into chunks', () => {
    const start = Date.parse('2022-02-06T14:10:03.234');
    const end = Date.parse('2022-02-06T14:11:03.567');

    expect(getRangeChunks(start, end, 10000)).toStrictEqual([
      [Date.parse('2022-02-06T14:10:03.234'), Date.parse('2022-02-06T14:10:03.567')],
      [Date.parse('2022-02-06T14:10:03.567'), Date.parse('2022-02-06T14:10:13.567')],
      [Date.parse('2022-02-06T14:10:13.567'), Date.parse('2022-02-06T14:10:23.567')],
      [Date.parse('2022-02-06T14:10:23.567'), Date.parse('2022-02-06T14:10:33.567')],
      [Date.parse('2022-02-06T14:10:33.567'), Date.parse('2022-02-06T14:10:43.567')],
      [Date.parse('2022-02-06T14:10:43.567'), Date.parse('2022-02-06T14:10:53.567')],
      [Date.parse('2022-02-06T14:10:53.567'), Date.parse('2022-02-06T14:11:03.567')],
    ]);
  });

  it('should split time range into chunks, when nicely aligned', () => {
    const start = Date.parse('2022-02-06T14:10:03.567');
    const end = Date.parse('2022-02-06T14:11:03.567');

    expect(getRangeChunks(start, end, 20000)).toStrictEqual([
      [Date.parse('2022-02-06T14:10:03.567'), Date.parse('2022-02-06T14:10:23.567')],
      [Date.parse('2022-02-06T14:10:23.567'), Date.parse('2022-02-06T14:10:43.567')],
      [Date.parse('2022-02-06T14:10:43.567'), Date.parse('2022-02-06T14:11:03.567')],
    ]);
  });
});
