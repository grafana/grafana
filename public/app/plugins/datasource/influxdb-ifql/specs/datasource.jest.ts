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

  describe('prepareQueryTarget()', () => {
    let target: any;

    it('replaces $range variable', () => {
      target = ds.prepareQueryTarget({ query: 'from(db: "test") |> range($range)' }, DEFAULT_OPTIONS);
      expect(target.query).toBe('from(db: "test") |> range(start: -3h)');
    });

    it('replaces $range variable with custom dates', () => {
      const to = moment();
      const from = moment().subtract(1, 'hours');
      target = ds.prepareQueryTarget(
        { query: 'from(db: "test") |> range($range)' },
        {
          ...DEFAULT_OPTIONS,
          rangeRaw: { to, from },
        }
      );
      const start = from.toISOString();
      const stop = to.toISOString();
      expect(target.query).toBe(`from(db: "test") |> range(start: ${start}, stop: ${stop})`);
    });
  });
});
