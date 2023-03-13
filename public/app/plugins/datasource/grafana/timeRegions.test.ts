import { dateTime, toDataFrameDTO } from '@grafana/data';

import { doTimeRegionQuery } from './timeRegions';

describe('grafana data source', () => {
  it('supports time region query', () => {
    const out = doTimeRegionQuery(
      { name: 'T1', color: 'green', fromDayOfWeek: 1, toDayOfWeek: 2 },
      {
        from: dateTime('2021-01-00', 'YYYY-MM-dd'),
        to: dateTime('2021-02-00', 'YYYY-MM-dd'),
        raw: {
          to: '',
          from: '',
        },
      },
      'utc'
    );

    expect(toDataFrameDTO(out!)).toMatchSnapshot(); // inline??
  });
});
