import { v4 as uuidv4 } from 'uuid';

import { getDefaultTimeRange, DataFrameView } from '@grafana/data';
import { QueryFormat, SQLQuery, SQLSelectableValue } from '@grafana/plugin-ui';
import { DataQuery } from '@grafana/schema';
import { mapFieldsToTypes } from 'app/plugins/datasource/mysql/fields';
import { quoteIdentifierIfNecessary } from 'app/plugins/datasource/mysql/sqlUtil';

import { dataSource } from '../ExpressionDatasource';

export async function fetchSQLFields(query: Partial<SQLQuery>, queries: DataQuery[]): Promise<SQLSelectableValue[]> {
  const datasource = dataSource;
  if (!query.table) {
    return [];
  }

  const queryString = `SELECT * FROM ${query.table} LIMIT 1`;

  const queryResponse = await datasource.runMetaSQLExprQuery(
    { rawSql: queryString, format: QueryFormat.Table, refId: `fields-${uuidv4()}` },
    getDefaultTimeRange(),
    queries.filter((q) => q.refId === query.table)
  );
  const frame = new DataFrameView<string[]>(queryResponse);

  const fields = Object.values(frame.fields).map(({ name, type }) => {
    return {
      name,
      text: name,
      label: name,
      value: quoteIdentifierIfNecessary(name),
      type,
    };
  });

  return mapFieldsToTypes(fields);
}

// based off https://github.com/grafana/grafana/blob/main/pkg/expr/sql/parser_allow.go
export const ALLOWED_FUNCTIONS = [
  'if',
  'coalesce',
  'ifnull',
  'nullif',
  'sum',
  'avg',
  'count',
  'min',
  'max',
  'stddev',
  'std',
  'stddev_pop',
  'variance',
  'var_pop',
  'group_concat',
  'row_number',
  'rank',
  'dense_rank',
  'lead',
  'lag',
  'first_value',
  'last_value',
  'abs',
  'round',
  'floor',
  'ceiling',
  'ceil',
  'sqrt',
  'pow',
  'power',
  'mod',
  'log',
  'log10',
  'exp',
  'sign',
  'ln',
  'truncate',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'rand',
  'pi',
  'concat',
  'length',
  'char_length',
  'lower',
  'upper',
  'substring',
  'substring_index',
  'left',
  'right',
  'ltrim',
  'rtrim',
  'replace',
  'reverse',
  'lcase',
  'ucase',
  'mid',
  'repeat',
  'position',
  'instr',
  'locate',
  'ascii',
  'ord',
  'char',
  'regexp_substr',
  'str_to_date',
  'date_format',
  'date_add',
  'date_sub',
  'year',
  'month',
  'day',
  'weekday',
  'datediff',
  'unix_timestamp',
  'from_unixtime',
  'extract',
  'hour',
  'minute',
  'second',
  'dayname',
  'monthname',
  'dayofweek',
  'dayofmonth',
  'dayofyear',
  'week',
  'quarter',
  'time_to_sec',
  'sec_to_time',
  'timestampdiff',
  'timestampadd',
  'cast',
  'convert',
  'json_extract',
  'json_object',
  'json_array',
  'json_merge_patch',
  'json_valid',
  'json_contains',
  'json_length',
  'json_type',
  'json_keys',
  'json_search',
  'json_quote',
  'json_unquote',
  'json_set',
  'json_insert',
  'json_replace',
  'json_remove',
];
