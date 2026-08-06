import { type Config, type JsonTree, Utils } from '@react-awesome-query-builder/ui';

import { raqbConfig } from './AwesomeQueryBuilder';

// Route RAQB's `import moment from 'moment'` through the luxon-backed compat adapter, mirroring
// what plugin webpack builds do via the `moment$` resolve alias in @grafana/plugin-configs, so
// these tests exercise the adapter's date handling rather than the real moment library.
jest.mock('moment', () => require('../../utils/raqbMomentCompat'));

const config: Config = {
  ...raqbConfig,
  fields: {
    createdAt: { label: 'Created at', type: 'datetime', valueSources: ['value'] },
    bornOn: { label: 'Born on', type: 'date', valueSources: ['value'] },
    wakeAt: { label: 'Wake at', type: 'time', valueSources: ['value'] },
  },
};

function ruleTree(field: string, operator: string, value: string, valueType: string): JsonTree {
  return {
    id: Utils.uuid(),
    type: 'group',
    children1: [
      {
        type: 'rule',
        properties: { field, operator, value: [value], valueSrc: ['value'], valueType: [valueType] },
      },
    ],
  };
}

function toSql(tree: JsonTree): string | undefined {
  return Utils.sqlFormat(Utils.checkTree(Utils.loadTree(tree), config), config);
}

// date/time/datetime values flow through RAQB's built-in formatters, which parse and re-format
// them with moment format tokens ('YYYY-MM-DD HH:mm:ss' etc.), so these catch date regressions
describe('query builder date handling', () => {
  it('formats datetime conditions', () => {
    expect(toSql(ruleTree('createdAt', 'greater', '2024-05-06 10:30:00', 'datetime'))).toBe(
      "createdAt > '2024-05-06 10:30:00.000'"
    );
  });

  it('turns unparseable datetime values into NULL', () => {
    expect(toSql(ruleTree('createdAt', 'greater', 'not a date', 'datetime'))).toBe('createdAt > NULL');
  });

  it('formats date conditions', () => {
    expect(toSql(ruleTree('bornOn', 'equal', '2024-05-06', 'date'))).toBe("bornOn = '2024-05-06'");
  });

  it('formats time conditions', () => {
    expect(toSql(ruleTree('wakeAt', 'equal', '10:30:00', 'time'))).toBe("wakeAt = '10:30:00'");
  });

  it('expands datetime macros instead of formatting them as dates', () => {
    // the stored value is the bare macro name; the macros operator's sqlFormatOp expands it
    expect(toSql(ruleTree('createdAt', 'macros', 'timeFilter', 'datetime'))).toBe('$__timeFilter(createdAt)');
  });
});
