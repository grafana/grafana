import { Completion, completeFromList, ifNotIn } from '@codemirror/autocomplete';

const dontComplete = ['Comment', 'Docblock', 'String', 'FString', 'RString', 'SString'];

const globals: readonly Completion[] = ['false', 'null', 'true']
  .map((n) => ({ label: n, type: 'constant' }))
  .concat(
    ['bool', 'float', 'int', 'int8', 'int16', 'int32', 'int64', 'int128', 'text', 'date', 'time', 'timestamp'].map(
      (n) => ({ label: n, type: 'type' })
    )
  )
  .concat(
    [
      // aggregate-functions
      'any',
      'average',
      'concat_array',
      'count',
      'every',
      'max',
      'min',
      'stddev',
      'sum',
      // file-reading-functions
      'read_csv',
      'read_parquet',
      // list-functions
      'all',
      'map',
      'zip',
      '_eq',
      '_is_null',
      // misc-functions
      'from_text',
      // string-functions
      'lower',
      'upper',
      // window-functions
      'lag',
      'lead',
      'first',
      'last',
      'rank',
      'rank_dense',
      'row_number',
    ].map((n) => ({ label: n, type: 'function' }))
  )
  .concat(
    ['aggregate', 'derive', 'filter', 'from', 'group', 'join', 'select', 'sort', 'take', 'window'].map((n) => ({
      label: n,
      type: 'keyword',
    }))
  )
  .concat(['std'].map((n) => ({ label: n, type: 'namespace' })));

export const snippets: readonly Completion[] = [
  // snippetCompletion('from ${table_table}\nselect {${column_name}}\nfilter ${column_name} == ${condition}\ntake {amount}', {
  //   label: 'from-select-filter-take',
  //   detail: 'snippet',
  //   type: 'text',
  // }),
];

/// Autocompletion for built-in PRQL globals and keywords.
export const globalCompletion = ifNotIn(dontComplete, completeFromList(globals.concat(snippets)));
