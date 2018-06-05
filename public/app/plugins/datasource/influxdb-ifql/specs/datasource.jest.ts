import moment from 'moment';

import { TemplateSrv } from 'app/features/templating/template_srv';

import Datasource from '../datasource';

describe('InfluxDB (IFQL)', () => {
  const templateSrv = new TemplateSrv();
  const ds = new Datasource({ url: '' }, {}, templateSrv);
  const DEFAULT_OPTIONS = {
    rangeRaw: { to: 'now', from: 'now - 3h' },
    scopedVars: {},
    targets: [],
  };

  let queries: any[];

  describe('prepareQueries()', () => {
    it('filters empty queries', () => {
      queries = ds.prepareQueries(DEFAULT_OPTIONS);
      expect(queries.length).toBe(0);

      queries = ds.prepareQueries({
        ...DEFAULT_OPTIONS,
        targets: [{ query: '' }],
      });
      expect(queries.length).toBe(0);
    });

    it('replaces $range variable', () => {
      queries = ds.prepareQueries({
        ...DEFAULT_OPTIONS,
        targets: [{ query: 'from(db: "test") |> range($range)' }],
      });
      expect(queries.length).toBe(1);
      expect(queries[0].query).toBe('from(db: "test") |> range(start: -3h)');
    });

    it('replaces $range variable with custom dates', () => {
      const to = moment();
      const from = moment().subtract(1, 'hours');
      queries = ds.prepareQueries({
        ...DEFAULT_OPTIONS,
        rangeRaw: { to, from },
        targets: [{ query: 'from(db: "test") |> range($range)' }],
      });
      expect(queries.length).toBe(1);
      const start = from.toISOString();
      const stop = to.toISOString();
      expect(queries[0].query).toBe(`from(db: "test") |> range(start: ${start}, stop: ${stop})`);
    });
  });
});
