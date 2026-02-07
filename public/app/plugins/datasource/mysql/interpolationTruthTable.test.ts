import { DataSourceInstanceSettings, ScopedVars, VariableWithMultiSupport } from '@grafana/data';
import { setTemplateSrv, TemplateSrv as RuntimeTemplateSrv } from '@grafana/runtime';

import { MySqlDatasource } from './MySqlDatasource';
import { MySQLOptions } from './types';

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

describe('MySqlDatasource interpolation truth table', () => {
  const instanceSettings = {
    id: 0,
    name: 'MySQL',
    type: 'mysql',
    jsonData: {},
  } as unknown as DataSourceInstanceSettings<MySQLOptions>;

  const templateSrv = new MockTemplateSrv();

  beforeAll(() => {
    setTemplateSrv(templateSrv);
  });

  const ds = new MySqlDatasource(instanceSettings);

  const runCase = (tc: TruthCase) => {
    const result = templateSrv.replace(tc.rawSql, tc.scopedVars, ds.interpolateVariable);
    expect(result).toBe(tc.expectedSql);
  };

  // ==================== BASIC WHERE EQUALS ====================

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

  // ==================== WHERE IN - MULTI VALUES ====================

  it('WHERE IN multi (unquoted)', () =>
    runCase({
      name: 'WHERE IN multi (unquoted)',
      rawSql: 'SELECT * FROM host_status WHERE host IN ($host)',
      scopedVars: { host: makeScoped(['srv1', 'srv2'], makeVariable('host', { multi: true })) },
      expectedSql: `SELECT * FROM host_status WHERE host IN ('srv1','srv2')`,
    }));

  it('WHERE IN multi with sqlstring formatter', () =>
    runCase({
      name: 'WHERE IN multi with sqlstring formatter',
      rawSql: 'SELECT * FROM host_status WHERE host IN (${host:sqlstring})',
      scopedVars: { host: makeScoped(['srv1', 'srv2'], makeVariable('host', { multi: true })) },
      expectedSql: `SELECT * FROM host_status WHERE host IN ('srv1','srv2')`,
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

  it('WHERE IN multi variable with three values', () =>
    runCase({
      name: 'WHERE IN multi variable with three values',
      rawSql: 'SELECT * FROM hosts WHERE hostname IN ($hostname)',
      scopedVars: { hostname: makeScoped(['app1', 'app2', 'app3'], makeVariable('hostname', { multi: true })) },
      expectedSql: `SELECT * FROM hosts WHERE hostname IN ('app1','app2','app3')`,
    }));

  // ==================== INCLUDE ALL / ALL VALUE ====================

  it('WHERE IN includeAll no allValue expands to selected list', () =>
    runCase({
      name: 'WHERE IN includeAll no allValue expands to selected list',
      rawSql: 'SELECT * FROM regions WHERE region IN ($region)',
      scopedVars: { region: makeScoped(['us', 'eu'], makeVariable('region', { includeAll: true })) },
      expectedSql: `SELECT * FROM regions WHERE region IN ('us','eu')`,
    }));

  it('WHERE equals includeAll with single value', () =>
    runCase({
      name: 'WHERE equals includeAll with single value',
      rawSql: "SELECT * FROM regions WHERE region = '$region'",
      scopedVars: { region: makeScoped('us-east', makeVariable('region', { includeAll: true })) },
      // in mysql ds, if variable is includeAll=true then the value gets wrapped with single quotes
      expectedSql: "SELECT * FROM regions WHERE region = ''us-east''",
    }));

  // ==================== LIKE PATTERNS ====================

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
      rawSql: "SELECT * FROM hosts WHERE hostname LIKE '%$host%'",
      scopedVars: { host: makeScoped('app1', makeVariable('host')) },
      expectedSql: "SELECT * FROM hosts WHERE hostname LIKE '%app1%'",
    }));

  it('LIKE with pattern variable', () =>
    runCase({
      name: 'LIKE with pattern variable',
      rawSql: "SELECT * FROM logs WHERE message LIKE '$pattern'",
      scopedVars: { pattern: makeScoped('error%', makeVariable('pattern')) },
      expectedSql: "SELECT * FROM logs WHERE message LIKE 'error%'",
    }));

  // ==================== IDENTIFIERS (BACKTICKS) ====================

  it('Identifier substitution with backticks (database.table)', () =>
    runCase({
      name: 'Identifier substitution with backticks',
      rawSql: 'SELECT * FROM `$database`.`$table`',
      scopedVars: {
        database: makeScoped('mydb', makeVariable('database')),
        table: makeScoped('orders', makeVariable('table')),
      },
      expectedSql: 'SELECT * FROM `mydb`.`orders`',
    }));

  it('Identifier substitution without backticks', () =>
    runCase({
      name: 'Identifier substitution without backticks',
      rawSql: 'SELECT * FROM $database.$table',
      scopedVars: {
        database: makeScoped('mydb', makeVariable('database')),
        table: makeScoped('orders', makeVariable('table')),
      },
      expectedSql: 'SELECT * FROM mydb.orders',
    }));

  it('Column identifier in SELECT with backticks', () =>
    runCase({
      name: 'Column identifier in SELECT with backticks',
      rawSql: 'SELECT `$column` FROM metrics',
      scopedVars: { column: makeScoped('value', makeVariable('column')) },
      expectedSql: 'SELECT `value` FROM metrics',
    }));

  it('Group by identifier with backticks', () =>
    runCase({
      name: 'Group by identifier with backticks',
      rawSql: 'SELECT avg(value) FROM metrics GROUP BY `$groupBy`',
      scopedVars: { groupBy: makeScoped('service', makeVariable('groupBy')) },
      expectedSql: 'SELECT avg(value) FROM metrics GROUP BY `service`',
    }));

  // ==================== LIMIT / OFFSET ====================

  it('LIMIT with numeric variable', () =>
    runCase({
      name: 'LIMIT with numeric variable',
      rawSql: 'SELECT * FROM metrics LIMIT $limit',
      scopedVars: { limit: makeScoped(100, makeVariable('limit')) },
      expectedSql: 'SELECT * FROM metrics LIMIT 100',
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

  it('LIMIT with string numeric converted', () =>
    runCase({
      name: 'LIMIT with string numeric',
      rawSql: 'SELECT * FROM metrics LIMIT $limit',
      scopedVars: { limit: makeScoped('10', makeVariable('limit')) },
      expectedSql: 'SELECT * FROM metrics LIMIT 10',
    }));

  // ==================== BETWEEN RANGES ====================

  it('Range filter using BETWEEN (unquoted)', () =>
    runCase({
      name: 'Range filter using BETWEEN (unquoted)',
      rawSql: 'SELECT * FROM events WHERE date BETWEEN $start AND $end',
      scopedVars: {
        start: makeScoped('2024-01-01', makeVariable('start')),
        end: makeScoped('2024-01-31', makeVariable('end')),
      },
      expectedSql: 'SELECT * FROM events WHERE date BETWEEN 2024-01-01 AND 2024-01-31',
    }));

  it('Range filter using BETWEEN (quoted)', () =>
    runCase({
      name: 'Range filter using BETWEEN (quoted)',
      rawSql: "SELECT * FROM events WHERE date BETWEEN '$start' AND '$end'",
      scopedVars: {
        start: makeScoped('2024-01-01', makeVariable('start')),
        end: makeScoped('2024-01-31', makeVariable('end')),
      },
      expectedSql: "SELECT * FROM events WHERE date BETWEEN '2024-01-01' AND '2024-01-31'",
    }));

  it('Numeric range with BETWEEN', () =>
    runCase({
      name: 'Numeric range with BETWEEN',
      rawSql: 'SELECT * FROM metrics WHERE value BETWEEN $min AND $max',
      scopedVars: {
        min: makeScoped(10, makeVariable('min')),
        max: makeScoped(100, makeVariable('max')),
      },
      expectedSql: 'SELECT * FROM metrics WHERE value BETWEEN 10 AND 100',
    }));

  // ==================== REGEXP / RLIKE ====================

  it('REGEXP with pattern (unquoted)', () =>
    runCase({
      name: 'REGEXP with pattern (unquoted)',
      rawSql: 'SELECT * FROM hosts WHERE hostname REGEXP $pattern',
      scopedVars: { pattern: makeScoped('server.*', makeVariable('pattern')) },
      expectedSql: 'SELECT * FROM hosts WHERE hostname REGEXP server.*',
    }));

  it('REGEXP with pattern (quoted)', () =>
    runCase({
      name: 'REGEXP with pattern (quoted)',
      rawSql: "SELECT * FROM hosts WHERE hostname REGEXP '$pattern'",
      scopedVars: { pattern: makeScoped('server.*', makeVariable('pattern')) },
      expectedSql: "SELECT * FROM hosts WHERE hostname REGEXP 'server.*'",
    }));

  it('RLIKE with includeAll set to .*', () =>
    runCase({
      name: 'RLIKE with includeAll set to .*',
      rawSql: 'SELECT * FROM hosts WHERE hostname RLIKE $host',
      scopedVars: { host: makeScoped('.*', makeVariable('host', { includeAll: true, allValue: '.*' })) },
      expectedSql: `SELECT * FROM hosts WHERE hostname RLIKE '.*'`,
    }));

  // ==================== GRAFANA MACROS ====================

  it('Time filter macro with multi region', () =>
    runCase({
      name: 'Time filter macro with multi region',
      rawSql: 'SELECT * FROM metrics WHERE $__timeFilter(timestamp) AND region IN ($region)',
      scopedVars: { region: makeScoped(['us', 'eu'], makeVariable('region', { multi: true })) },
      expectedSql: `SELECT * FROM metrics WHERE $__timeFilter(timestamp) AND region IN ('us','eu')`,
    }));

  it('Time group macro with interval variable', () =>
    runCase({
      name: 'Time group macro with interval variable',
      rawSql: 'SELECT $__timeGroupAlias(timestamp, $bucket) AS time, avg(v) FROM metrics GROUP BY 1',
      scopedVars: { bucket: makeScoped('5m', makeVariable('bucket')) },
      expectedSql: 'SELECT $__timeGroupAlias(timestamp, 5m) AS time, avg(v) FROM metrics GROUP BY 1',
    }));

  it('Time epoch macro with interval and fill', () =>
    runCase({
      name: 'Time epoch macro with interval and fill',
      rawSql: 'SELECT $__timeEpoch(timestamp) AS time FROM events WHERE region = $region',
      scopedVars: { region: makeScoped('us-east', makeVariable('region')) },
      expectedSql: 'SELECT $__timeEpoch(timestamp) AS time FROM events WHERE region = us-east',
    }));

  // ==================== JOINS ====================

  it('JOIN with IN clause filter', () =>
    runCase({
      name: 'JOIN with IN clause filter',
      rawSql: 'SELECT * FROM devices d JOIN regions r ON d.region_id = r.id WHERE r.name IN ($region)',
      scopedVars: { region: makeScoped(['us', 'eu'], makeVariable('region', { multi: true })) },
      expectedSql: `SELECT * FROM devices d JOIN regions r ON d.region_id = r.id WHERE r.name IN ('us','eu')`,
    }));

  it('JOIN with numeric condition', () =>
    runCase({
      name: 'JOIN with numeric condition',
      rawSql: 'SELECT * FROM t1 JOIN t2 ON t1.id = t2.id WHERE t2.value > $threshold',
      scopedVars: { threshold: makeScoped(100, makeVariable('threshold')) },
      expectedSql: 'SELECT * FROM t1 JOIN t2 ON t1.id = t2.id WHERE t2.value > 100',
    }));

  // ==================== SPECIAL CHARACTERS ====================

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
      name: 'Period in value',
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

  it('Backslash in value (MySQL escaping)', () =>
    runCase({
      name: 'Backslash in value',
      rawSql: "SELECT * FROM paths WHERE path = '$path'",
      scopedVars: { path: makeScoped('C:\\Users\\test', makeVariable('path')) },
      // In MySQL, backslashes are special but single quote escaping takes precedence
      expectedSql: "SELECT * FROM paths WHERE path = 'C:\\Users\\test'",
    }));

  // ==================== ANNOTATION QUERIES ====================

  it('Annotation query with tag variable in SELECT', () =>
    runCase({
      name: 'Annotation query with tag variable in SELECT',
      rawSql: 'SELECT timestamp AS time, message AS text, $tag AS tags FROM events',
      scopedVars: { tag: makeScoped('deploy', makeVariable('tag')) },
      expectedSql: 'SELECT timestamp AS time, message AS text, deploy AS tags FROM events',
    }));

  it('Annotation query with tag filter', () =>
    runCase({
      name: 'Annotation query with tag filter',
      rawSql: "SELECT timestamp AS time, message AS text FROM events WHERE tags = '$tag'",
      scopedVars: { tag: makeScoped('alert', makeVariable('tag')) },
      expectedSql: "SELECT timestamp AS time, message AS text FROM events WHERE tags = 'alert'",
    }));

  // ==================== SUBQUERIES ====================

  it('Subquery with variable in WHERE', () =>
    runCase({
      name: 'Subquery with variable in WHERE',
      rawSql: "SELECT * FROM hosts WHERE id IN (SELECT host_id FROM metrics WHERE region = '$region')",
      scopedVars: { region: makeScoped('us-east', makeVariable('region')) },
      expectedSql: "SELECT * FROM hosts WHERE id IN (SELECT host_id FROM metrics WHERE region = 'us-east')",
    }));

  it('Subquery with multi-value IN clause', () =>
    runCase({
      name: 'Subquery with multi-value IN clause',
      rawSql: 'SELECT * FROM hosts WHERE id IN (SELECT host_id FROM metrics WHERE region IN ($region))',
      scopedVars: { region: makeScoped(['us', 'eu'], makeVariable('region', { multi: true })) },
      expectedSql: `SELECT * FROM hosts WHERE id IN (SELECT host_id FROM metrics WHERE region IN ('us','eu'))`,
    }));

  // ==================== COMPLEX QUERIES ====================

  it('Complex query with multiple variable types', () =>
    runCase({
      name: 'Complex query with multiple variable types',
      rawSql: 'SELECT * FROM `$database`.`$table` WHERE `$column` IN ($values) AND timestamp > $start LIMIT $limit',
      scopedVars: {
        database: makeScoped('metrics', makeVariable('database')),
        table: makeScoped('cpu', makeVariable('table')),
        column: makeScoped('host', makeVariable('column')),
        values: makeScoped(['srv1', 'srv2'], makeVariable('values', { multi: true })),
        start: makeScoped('2024-01-01', makeVariable('start')),
        limit: makeScoped(100, makeVariable('limit')),
      },
      expectedSql: `SELECT * FROM \`metrics\`.\`cpu\` WHERE \`host\` IN ('srv1','srv2') AND timestamp > 2024-01-01 LIMIT 100`,
    }));

  it('Nested conditions with multiple multi variables', () =>
    runCase({
      name: 'Nested conditions with multiple multi variables',
      rawSql: 'SELECT * FROM hosts WHERE (host IN ($hosts) OR region IN ($regions)) AND active = $active',
      scopedVars: {
        hosts: makeScoped(['srv1', 'srv2'], makeVariable('hosts', { multi: true })),
        regions: makeScoped(['us', 'eu'], makeVariable('regions', { multi: true })),
        active: makeScoped(1, makeVariable('active')),
      },
      expectedSql: `SELECT * FROM hosts WHERE (host IN ('srv1','srv2') OR region IN ('us','eu')) AND active = 1`,
    }));

  // ==================== ORDER BY ====================

  it('ORDER BY with column variable', () =>
    runCase({
      name: 'ORDER BY with column variable',
      rawSql: 'SELECT * FROM users ORDER BY $column',
      scopedVars: { column: makeScoped('name', makeVariable('column')) },
      expectedSql: 'SELECT * FROM users ORDER BY name',
    }));

  it('ORDER BY with column and direction variables', () =>
    runCase({
      name: 'ORDER BY with column and direction variables',
      rawSql: 'SELECT * FROM users ORDER BY $column $direction',
      scopedVars: {
        column: makeScoped('created_at', makeVariable('column')),
        direction: makeScoped('DESC', makeVariable('direction')),
      },
      expectedSql: 'SELECT * FROM users ORDER BY created_at DESC',
    }));

  // ==================== CASE STATEMENTS ====================

  it('CASE statement with variable in WHEN', () =>
    runCase({
      name: 'CASE statement with variable',
      rawSql: "SELECT CASE WHEN status = '$status' THEN 1 ELSE 0 END FROM orders",
      scopedVars: { status: makeScoped('completed', makeVariable('status')) },
      expectedSql: "SELECT CASE WHEN status = 'completed' THEN 1 ELSE 0 END FROM orders",
    }));

  // ==================== NUMERIC EDGE CASES ====================

  it('Decimal numeric value', () =>
    runCase({
      name: 'Decimal numeric value',
      rawSql: 'SELECT * FROM metrics WHERE value > $threshold',
      scopedVars: { threshold: makeScoped(10.5, makeVariable('threshold')) },
      expectedSql: 'SELECT * FROM metrics WHERE value > 10.5',
    }));

  it('Negative numeric value', () =>
    runCase({
      name: 'Negative numeric value',
      rawSql: 'SELECT * FROM temperatures WHERE temp < $threshold',
      scopedVars: { threshold: makeScoped(-10, makeVariable('threshold')) },
      expectedSql: 'SELECT * FROM temperatures WHERE temp < -10',
    }));

  // ==================== EMPTY/NULL-LIKE VALUES ====================

  it('Empty string value', () =>
    runCase({
      name: 'Empty string value',
      rawSql: "SELECT * FROM logs WHERE message = '$msg'",
      scopedVars: { msg: makeScoped('', makeVariable('msg')) },
      expectedSql: "SELECT * FROM logs WHERE message = ''",
    }));

  it('String "null" value (not NULL keyword)', () =>
    runCase({
      name: 'String "null" value',
      rawSql: "SELECT * FROM data WHERE value = '$value'",
      scopedVars: { value: makeScoped('null', makeVariable('value')) },
      expectedSql: "SELECT * FROM data WHERE value = 'null'",
    }));

  // ==================== HAVING CLAUSE ====================

  it('HAVING clause with variable', () =>
    runCase({
      name: 'HAVING clause with variable',
      rawSql: 'SELECT host, COUNT(*) FROM metrics GROUP BY host HAVING COUNT(*) > $threshold',
      scopedVars: { threshold: makeScoped(10, makeVariable('threshold')) },
      expectedSql: 'SELECT host, COUNT(*) FROM metrics GROUP BY host HAVING COUNT(*) > 10',
    }));

  // ==================== UNION QUERIES ====================

  it('UNION with variables in both queries', () =>
    runCase({
      name: 'UNION with variables',
      rawSql: "SELECT * FROM hosts WHERE region = '$region1' UNION SELECT * FROM hosts WHERE region = '$region2'",
      scopedVars: {
        region1: makeScoped('us-east', makeVariable('region1')),
        region2: makeScoped('eu-west', makeVariable('region2')),
      },
      expectedSql: "SELECT * FROM hosts WHERE region = 'us-east' UNION SELECT * FROM hosts WHERE region = 'eu-west'",
    }));

  // ==================== FIND_IN_SET (MySQL specific) ====================

  it('FIND_IN_SET with variable', () =>
    runCase({
      name: 'FIND_IN_SET with variable',
      rawSql: "SELECT * FROM users WHERE FIND_IN_SET('$role', roles) > 0",
      scopedVars: { role: makeScoped('admin', makeVariable('role')) },
      expectedSql: "SELECT * FROM users WHERE FIND_IN_SET('admin', roles) > 0",
    }));

  // ==================== CAST / CONVERT ====================

  it('CAST with variable', () =>
    runCase({
      name: 'CAST with variable',
      rawSql: 'SELECT * FROM data WHERE CAST(value AS UNSIGNED) = $numValue',
      scopedVars: { numValue: makeScoped(42, makeVariable('numValue')) },
      expectedSql: 'SELECT * FROM data WHERE CAST(value AS UNSIGNED) = 42',
    }));

  // ==================== FUNCTIONS WITH VARIABLES ====================

  it('CONCAT with variable', () =>
    runCase({
      name: 'CONCAT with variable',
      rawSql: "SELECT CONCAT('prefix_', $suffix) AS combined FROM data",
      scopedVars: { suffix: makeScoped('value', makeVariable('suffix')) },
      expectedSql: "SELECT CONCAT('prefix_', value) AS combined FROM data",
    }));

  it('DATE_FORMAT with variable', () =>
    runCase({
      name: 'DATE_FORMAT with variable',
      rawSql: "SELECT DATE_FORMAT(timestamp, '$format') FROM events",
      scopedVars: { format: makeScoped('%Y-%m-%d', makeVariable('format')) },
      expectedSql: "SELECT DATE_FORMAT(timestamp, '%Y-%m-%d') FROM events",
    }));

  // ==================== MULTI-LINE QUERIES ====================

  it('Multi-line query with variables', () =>
    runCase({
      name: 'Multi-line query',
      rawSql: `SELECT *
FROM hosts
WHERE region IN ($regions)
  AND status = '$status'
  AND uptime > $uptime
ORDER BY name`,
      scopedVars: {
        regions: makeScoped(['us', 'eu'], makeVariable('regions', { multi: true })),
        status: makeScoped('active', makeVariable('status')),
        uptime: makeScoped(3600, makeVariable('uptime')),
      },
      expectedSql: `SELECT *
FROM hosts
WHERE region IN ('us','eu')
  AND status = 'active'
  AND uptime > 3600
ORDER BY name`,
    }));
});
