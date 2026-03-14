import { DataSourceInstanceSettings, ScopedVars, VariableWithMultiSupport } from '@grafana/data';
import { setTemplateSrv, TemplateSrv as RuntimeTemplateSrv } from '@grafana/runtime';

import { PostgresDatasource } from './datasource';
import { PostgresOptions } from './types';

type TruthCase = {
  name: string;
  rawSql: string;
  scopedVars: ScopedVars;
  expectedSql: string;
};

type ScopedVarWithVariable = {
  value: string | number | string[] | number[];
  text: string | number | string[] | number[];
  variable: VariableWithMultiSupport;
};

// Builds a minimal VariableWithMultiSupport shape, letting each test tweak multi/includeAll/allValue.
const makeVariable = (name: string, overrides?: Partial<VariableWithMultiSupport>): VariableWithMultiSupport =>
  ({
    name,
    multi: false,
    includeAll: false,
    allValue: undefined,
    ...overrides,
  }) as unknown as VariableWithMultiSupport;

// Wraps a value into the scopedVars entry structure (value/text + variable metadata).
const makeScoped = (value: string | number | string[] | number[], variable: VariableWithMultiSupport) => ({
  value,
  text: value,
  variable,
});

// Custom mock templateSrv that implements variable replacement with formatters.
// Supports: $var, ${var}, ${var:csv}, ${var:sqlstring}, ${var:singlequote}
class MockTemplateSrv implements RuntimeTemplateSrv {
  replace(target: string, scopedVars?: ScopedVars, format?: string | Function): string {
    if (!target || !scopedVars) {
      return target || '';
    }

    // Match ${var:formatter} or $var or ${var}
    const regex = /\$\{([^:}]+)(?::([^}]+))?\}|\$(\w+)/g;

    return target.replace(regex, (match, bracedVar, formatter, simpleVar) => {
      const varName = bracedVar || simpleVar;
      const scopedVar = scopedVars[varName];

      if (!scopedVar) {
        return match;
      }

      const value = scopedVar.value;
      const variable = (scopedVar as ScopedVarWithVariable).variable;

      // Apply formatter if specified
      if (formatter) {
        if (formatter === 'csv') {
          // csv: just comma-separate without quotes
          if (Array.isArray(value)) {
            return value.join(',');
          }
          return String(value);
        } else if (formatter === 'sqlstring') {
          // sqlstring: escape ' as '' and quote each value
          if (Array.isArray(value)) {
            return value.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',');
          }
          return `'${String(value).replace(/'/g, "''")}'`;
        } else if (formatter === 'singlequote') {
          // singlequote: escape ' as \' and quote each value
          if (Array.isArray(value)) {
            return value.map((v) => `'${String(v).replace(/'/g, "\\'")}'`).join(',');
          }
          return `'${String(value).replace(/'/g, "\\'")}'`;
        }
      }

      // No formatter: call the format function if provided
      if (typeof format === 'function') {
        return format(value, variable);
      }

      // Default: just return the value as-is
      if (Array.isArray(value)) {
        return value.join(',');
      }
      return String(value);
    });
  }

  getVariables() {
    return [];
  }

  updateTimeRange() {}

  containsTemplate(target?: string): boolean {
    if (!target) {
      return false;
    }
    return /\$\{[^}]+\}|\$\w+/.test(target);
  }

  getAdhocFilters() {
    return [];
  }

  getVariableName(expression: string) {
    const match = /\$\{([^:}]+)(?::[^}]+)?\}|\$(\w+)/.exec(expression);
    return match ? match[1] || match[2] : null;
  }
}

describe('PostgresDatasource interpolation truth table', () => {
  const instanceSettings = {
    id: 0,
    name: 'Postgres',
    type: 'grafana-postgresql-datasource',
    jsonData: {},
  } as unknown as DataSourceInstanceSettings<PostgresOptions>;

  const templateSrv = new MockTemplateSrv();

  beforeAll(() => {
    setTemplateSrv(templateSrv);
  });

  const ds = new PostgresDatasource(instanceSettings);

  const runCase = (tc: TruthCase) => {
    const result = templateSrv.replace(tc.rawSql, tc.scopedVars, ds.interpolateVariable);
    expect(result).toBe(tc.expectedSql);
  };

  it('WHERE equals single (unquoted)', () =>
    runCase({
      name: 'WHERE equals single (unquoted)',
      rawSql: 'SELECT * FROM host_status WHERE host = $host',
      scopedVars: { host: makeScoped('server01', makeVariable('host')) },
      expectedSql: 'SELECT * FROM host_status WHERE host = server01',
    }));

  it('WHERE equals single with manual quotes', () =>
    runCase({
      name: 'WHERE equals single with manual quotes',
      rawSql: "SELECT * FROM host_status WHERE host = '$host'",
      scopedVars: { host: makeScoped('server01', makeVariable('host')) },
      expectedSql: "SELECT * FROM host_status WHERE host = 'server01'",
    }));

  it('WHERE equals numeric', () =>
    runCase({
      name: 'WHERE equals numeric',
      rawSql: 'SELECT * FROM latency WHERE latency_ms < $threshold',
      scopedVars: { threshold: makeScoped(150, makeVariable('threshold')) },
      expectedSql: 'SELECT * FROM latency WHERE latency_ms < 150',
    }));

  it('WHERE IN multi (unquoted)', () =>
    runCase({
      name: 'WHERE IN multi (unquoted)',
      rawSql: 'SELECT * FROM host_status WHERE host IN ($host)',
      scopedVars: { host: makeScoped(['srv1', 'srv2'], makeVariable('host', { multi: true })) },
      expectedSql: `SELECT * FROM host_status WHERE host IN ('srv1','srv2')`,
    }));

  it(`WHERE IN multi (unquoted) with sqlstring formatter. This doesn't hit interpolateVariable method in ds as we use formatter.`, () =>
    runCase({
      name: 'WHERE IN multi (unquoted)',
      rawSql: 'SELECT * FROM host_status WHERE host IN (${host:sqlstring})',
      scopedVars: { host: makeScoped(['srv1', 'srv2'], makeVariable('host', { multi: true })) },
      expectedSql: `SELECT * FROM host_status WHERE host IN ('srv1','srv2')`,
    }));

  it('WHERE IN multi with manual quotes', () =>
    runCase({
      name: 'WHERE IN multi with manual quotes',
      rawSql: "SELECT * FROM host_status WHERE host IN ('$host')",
      scopedVars: { host: makeScoped(['srv1', 'srv2'], makeVariable('host', { multi: true })) },
      expectedSql: "SELECT * FROM host_status WHERE host IN (''srv1','srv2'')",
    }));

  it('WHERE IN multi numeric with :csv', () =>
    runCase({
      name: 'WHERE IN multi numeric with :csv',
      rawSql: 'SELECT * FROM latency WHERE latency_ms IN (${latency:csv})',
      scopedVars: { latency: makeScoped([50, 75], makeVariable('latency', { multi: true })) },
      expectedSql: 'SELECT * FROM latency WHERE latency_ms IN (50,75)',
    }));

  it('WHERE equals multi variable with single value', () =>
    runCase({
      name: 'WHERE equals multi variable with single value',
      rawSql: 'SELECT * FROM hosts WHERE hostname = $hostname',
      scopedVars: { hostname: makeScoped(['app1'], makeVariable('hostname', { multi: true })) },
      expectedSql: `SELECT * FROM hosts WHERE hostname = 'app1'`,
    }));

  it('WHERE IN includeAll explicit allValue (unquoted)', () =>
    runCase({
      name: 'WHERE IN includeAll explicit allValue (unquoted)',
      rawSql: 'SELECT * FROM regions WHERE region IN ($region)',
      scopedVars: { region: makeScoped('*', makeVariable('region', { includeAll: true, allValue: '*' })) },
      expectedSql: 'SELECT * FROM regions WHERE region IN (*)',
    }));

  it('WHERE IN includeAll explicit allValue with manual quotes', () =>
    runCase({
      name: 'WHERE IN includeAll explicit allValue with manual quotes',
      rawSql: "SELECT * FROM regions WHERE region IN ('$region')",
      scopedVars: { region: makeScoped('*', makeVariable('region', { includeAll: true, allValue: '*' })) },
      expectedSql: "SELECT * FROM regions WHERE region IN ('*')",
    }));

  it('WHERE IN includeAll no allValue expands to selected list', () =>
    runCase({
      name: 'WHERE IN includeAll no allValue expands to selected list',
      rawSql: 'SELECT * FROM regions WHERE region IN ($region)',
      scopedVars: { region: makeScoped(['us', 'eu'], makeVariable('region', { includeAll: true })) },
      expectedSql: `SELECT * FROM regions WHERE region IN ('us','eu')`,
    }));

  it('LIKE with $__searchFilter quoted', () =>
    runCase({
      name: 'LIKE with $__searchFilter quoted',
      rawSql: "SELECT * FROM hosts WHERE hostname LIKE '$__searchFilter'",
      scopedVars: { __searchFilter: makeScoped('app%', makeVariable('__searchFilter')) },
      expectedSql: "SELECT * FROM hosts WHERE hostname LIKE 'app%'",
    }));

  it('LIKE with variable inside wildcards', () =>
    runCase({
      name: 'LIKE with variable inside wildcards',
      rawSql: "SELECT * FROM hosts WHERE hostname ILIKE '%$host%'",
      scopedVars: { host: makeScoped('app1', makeVariable('host')) },
      expectedSql: "SELECT * FROM hosts WHERE hostname ILIKE '%app1%'",
    }));

  it('JOIN with ANY and multi parent variable', () =>
    runCase({
      name: 'JOIN with ANY and multi parent variable',
      rawSql: 'SELECT * FROM devices d JOIN regions r ON d.region = ANY(ARRAY[$region])',
      scopedVars: { region: makeScoped(['us', 'eu'], makeVariable('region', { multi: true })) },
      expectedSql: `SELECT * FROM devices d JOIN regions r ON d.region = ANY(ARRAY['us','eu'])`,
    }));

  it('Identifier substitution (schema/table)', () =>
    runCase({
      name: 'Identifier substitution (schema/table)',
      rawSql: 'SELECT * FROM "$schema"."$table"',
      scopedVars: {
        schema: makeScoped('public', makeVariable('schema')),
        table: makeScoped('orders', makeVariable('table')),
      },
      expectedSql: 'SELECT * FROM "public"."orders"',
    }));

  it('Group by identifier', () =>
    runCase({
      name: 'Group by identifier',
      rawSql: 'SELECT avg(value) FROM metrics GROUP BY "$groupBy"',
      scopedVars: { groupBy: makeScoped('service', makeVariable('groupBy')) },
      expectedSql: 'SELECT avg(value) FROM metrics GROUP BY "service"',
    }));

  it('LIMIT/OFFSET numeric with :csv', () =>
    runCase({
      name: 'LIMIT/OFFSET numeric with :csv',
      rawSql: 'SELECT * FROM metrics LIMIT ${limit:csv} OFFSET ${offset:csv}',
      scopedVars: {
        limit: makeScoped(100, makeVariable('limit')),
        offset: makeScoped(200, makeVariable('offset')),
      },
      expectedSql: 'SELECT * FROM metrics LIMIT 100 OFFSET 200',
    }));

  it('Time filter with multi region', () =>
    runCase({
      name: 'Time filter with multi region',
      rawSql: 'SELECT * FROM metrics WHERE $__timeFilter(ts) AND region IN ($region)',
      scopedVars: { region: makeScoped(['us', 'eu'], makeVariable('region', { multi: true })) },
      expectedSql: `SELECT * FROM metrics WHERE $__timeFilter(ts) AND region IN ('us','eu')`,
    }));

  it('Time bucket with interval variable', () =>
    runCase({
      name: 'Time bucket with interval variable',
      rawSql: 'SELECT $__timeGroupAlias(ts, $bucket) AS time, avg(v) FROM metrics GROUP BY 1',
      scopedVars: { bucket: makeScoped('5m', makeVariable('bucket')) },
      expectedSql: 'SELECT $__timeGroupAlias(ts, 5m) AS time, avg(v) FROM metrics GROUP BY 1',
    }));

  it('Range filter using BETWEEN (unquoted)', () =>
    runCase({
      name: 'Range filter using BETWEEN (unquoted)',
      rawSql: 'SELECT * FROM events WHERE ts BETWEEN $start AND $end',
      scopedVars: {
        start: makeScoped('2024-01-01', makeVariable('start')),
        end: makeScoped('2024-01-31', makeVariable('end')),
      },
      expectedSql: 'SELECT * FROM events WHERE ts BETWEEN 2024-01-01 AND 2024-01-31',
    }));

  it('Range filter using BETWEEN (quoted)', () =>
    runCase({
      name: 'Range filter using BETWEEN (quoted)',
      rawSql: "SELECT * FROM events WHERE ts BETWEEN '$start' AND '$end'",
      scopedVars: {
        start: makeScoped('2024-01-01', makeVariable('start')),
        end: makeScoped('2024-01-31', makeVariable('end')),
      },
      expectedSql: "SELECT * FROM events WHERE ts BETWEEN '2024-01-01' AND '2024-01-31'",
    }));

  it('Regex style with includeAll set to .*', () =>
    runCase({
      name: 'Regex style with includeAll set to .*',
      rawSql: 'SELECT * FROM hosts WHERE hostname ~ $host',
      scopedVars: { host: makeScoped('.*', makeVariable('host', { includeAll: true, allValue: '.*' })) },
      expectedSql: 'SELECT * FROM hosts WHERE hostname ~ .*',
    }));

  it('Nested variable style (resolved list)', () =>
    runCase({
      name: 'Nested variable style (resolved list)',
      rawSql: 'SELECT * FROM hosts WHERE host IN ($hosts)',
      scopedVars: { hosts: makeScoped(['srv-us-1', 'srv-eu-1'], makeVariable('hosts', { multi: true })) },
      expectedSql: `SELECT * FROM hosts WHERE host IN ('srv-us-1','srv-eu-1')`,
    }));

  it('Annotation query with tags variable', () =>
    runCase({
      name: 'Annotation query with tags variable',
      rawSql: 'SELECT ts AS time, msg AS text, $tag AS tags FROM events',
      scopedVars: { tag: makeScoped('deploy', makeVariable('tag')) },
      expectedSql: 'SELECT ts AS time, msg AS text, deploy AS tags FROM events',
    }));

  it('Single quote in single value with manual quotes', () =>
    runCase({
      name: 'Single quote in single value with manual quotes',
      rawSql: "SELECT * FROM users WHERE name = '$user'",
      scopedVars: { user: makeScoped("O'Brien", makeVariable('user')) },
      expectedSql: "SELECT * FROM users WHERE name = 'O''Brien'",
    }));

  it('Single quote in array value', () =>
    runCase({
      name: 'Single quote in array value',
      rawSql: 'SELECT * FROM users WHERE name IN ($users)',
      scopedVars: { users: makeScoped(["O'Brien", "D'Angelo"], makeVariable('users', { multi: true })) },
      expectedSql: `SELECT * FROM users WHERE name IN ('O''Brien','D''Angelo')`,
    }));

  it('Multiple single quotes in single value', () =>
    runCase({
      name: 'Multiple single quotes in single value',
      rawSql: "SELECT * FROM logs WHERE message = '$msg'",
      scopedVars: { msg: makeScoped("It's a test's message", makeVariable('msg')) },
      expectedSql: "SELECT * FROM logs WHERE message = 'It''s a test''s message'",
    }));

  it('Period in value (should be treated as data, not identifier)', () =>
    runCase({
      name: 'Period in value (should be treated as data, not identifier)',
      rawSql: "SELECT * FROM hosts WHERE hostname = '$host'",
      scopedVars: { host: makeScoped('server.example.com', makeVariable('host')) },
      expectedSql: "SELECT * FROM hosts WHERE hostname = 'server.example.com'",
    }));

  it('Period in array value', () =>
    runCase({
      name: 'Period in array value',
      rawSql: 'SELECT * FROM hosts WHERE hostname IN ($hosts)',
      scopedVars: {
        hosts: makeScoped(['server.example.com', 'db.example.org'], makeVariable('hosts', { multi: true })),
      },
      expectedSql: `SELECT * FROM hosts WHERE hostname IN ('server.example.com','db.example.org')`,
    }));

  it('Mixed special characters in array', () =>
    runCase({
      name: 'Mixed special characters in array',
      rawSql: 'SELECT * FROM users WHERE name IN ($names)',
      scopedVars: {
        names: makeScoped(["O'Brien", 'user.name', "test's"], makeVariable('names', { multi: true })),
      },
      expectedSql: `SELECT * FROM users WHERE name IN ('O''Brien','user.name','test''s')`,
    }));

  it('Multi variable with single string containing single quote', () =>
    runCase({
      name: 'Multi variable with single string containing single quote',
      rawSql: "SELECT * FROM users WHERE name = '$user'",
      scopedVars: { user: makeScoped("O'Brien", makeVariable('user', { multi: true })) },
      expectedSql: "SELECT * FROM users WHERE name = 'O''Brien'",
    }));

  it('includeAll variable with simple string (no allValue)', () =>
    runCase({
      name: 'includeAll variable with simple string (no allValue)',
      rawSql: "SELECT * FROM regions WHERE region = '$region'",
      scopedVars: { region: makeScoped('us-east', makeVariable('region', { includeAll: true })) },
      expectedSql: "SELECT * FROM regions WHERE region = 'us-east'",
    }));
});
