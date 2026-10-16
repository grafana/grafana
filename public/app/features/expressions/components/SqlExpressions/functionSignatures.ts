import { type SqlFunctionSignature } from './SqlEditor/signatureHelp';

/**
 * Signature metadata for the SQL Expression functions.
 *
 * This mirrors ALLOWED_FUNCTIONS (see ../../utils/metaSqlExpr, which itself
 * mirrors the backend allow-list in pkg/expr/sql/parser_allow.go). When a
 * function is added to or removed from the allow-list, update this list too.
 * Signatures follow MySQL semantics; optional/variadic arguments are noted in
 * the parameter documentation.
 */
export const FUNCTION_SIGNATURES: SqlFunctionSignature[] = [
  // Conditional / null handling
  {
    name: 'if',
    parameters: [
      { label: 'condition: boolean' },
      { label: 'then: any', documentation: 'Value returned when the condition is true.' },
      { label: 'else: any', documentation: 'Value returned when the condition is false.' },
    ],
    returnType: 'any',
    documentation: 'Returns then when the condition is true, otherwise else.',
  },
  {
    name: 'coalesce',
    parameters: [{ label: 'value: any' }, { label: '...values: any', documentation: 'Additional fallback values.' }],
    returnType: 'any',
    documentation: 'Returns the first non-NULL value from the arguments.',
  },
  {
    name: 'ifnull',
    parameters: [{ label: 'value: any' }, { label: 'fallback: any' }],
    returnType: 'any',
    documentation: 'Returns fallback when value is NULL, otherwise value.',
  },
  {
    name: 'nullif',
    parameters: [{ label: 'value: any' }, { label: 'compare: any' }],
    returnType: 'any',
    documentation: 'Returns NULL when the two arguments are equal, otherwise value.',
  },

  // Aggregates
  {
    name: 'sum',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the sum of all values in the group.',
  },
  {
    name: 'avg',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the average of all values in the group.',
  },
  {
    name: 'count',
    parameters: [{ label: 'value: any' }],
    returnType: 'number',
    documentation: 'Returns the number of rows or non-NULL values in the group.',
  },
  {
    name: 'min',
    parameters: [{ label: 'value: any' }],
    returnType: 'any',
    documentation: 'Returns the minimum value in the group.',
  },
  {
    name: 'max',
    parameters: [{ label: 'value: any' }],
    returnType: 'any',
    documentation: 'Returns the maximum value in the group.',
  },
  {
    name: 'stddev',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the population standard deviation of the values in the group.',
  },
  {
    name: 'std',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the population standard deviation of the values in the group.',
  },
  {
    name: 'stddev_pop',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the population standard deviation of the values in the group.',
  },
  {
    name: 'variance',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the population variance of the values in the group.',
  },
  {
    name: 'var_pop',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the population variance of the values in the group.',
  },
  {
    name: 'group_concat',
    parameters: [{ label: 'value: any' }],
    returnType: 'string',
    documentation: 'Concatenates non-NULL values in the group into a string. Supports a SEPARATOR clause.',
  },

  // Window functions
  {
    name: 'row_number',
    parameters: [],
    returnType: 'number',
    documentation: 'Returns the sequential number of the current row within its window.',
  },
  {
    name: 'rank',
    parameters: [],
    returnType: 'number',
    documentation: 'Returns the rank of the current row within its window, with gaps for ties.',
  },
  {
    name: 'dense_rank',
    parameters: [],
    returnType: 'number',
    documentation: 'Returns the rank of the current row within its window, without gaps for ties.',
  },
  {
    name: 'lead',
    parameters: [
      { label: 'value: any' },
      { label: 'offset: number', documentation: 'Number of rows ahead (default 1).' },
      { label: 'default: any', documentation: 'Value when the offset is out of range.' },
    ],
    returnType: 'any',
    documentation: 'Returns the value from a following row within the window.',
  },
  {
    name: 'lag',
    parameters: [
      { label: 'value: any' },
      { label: 'offset: number', documentation: 'Number of rows behind (default 1).' },
      { label: 'default: any', documentation: 'Value when the offset is out of range.' },
    ],
    returnType: 'any',
    documentation: 'Returns the value from a preceding row within the window.',
  },
  {
    name: 'first_value',
    parameters: [{ label: 'value: any' }],
    returnType: 'any',
    documentation: 'Returns the value from the first row of the window frame.',
  },
  {
    name: 'last_value',
    parameters: [{ label: 'value: any' }],
    returnType: 'any',
    documentation: 'Returns the value from the last row of the window frame.',
  },

  // Math
  {
    name: 'abs',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the absolute value of a number.',
  },
  {
    name: 'round',
    parameters: [
      { label: 'value: number' },
      { label: 'decimals: number', documentation: 'Number of decimal places (default 0).' },
    ],
    returnType: 'number',
    documentation: 'Rounds a number to the given number of decimal places.',
  },
  {
    name: 'floor',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the largest integer less than or equal to the value.',
  },
  {
    name: 'ceiling',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the smallest integer greater than or equal to the value.',
  },
  {
    name: 'ceil',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the smallest integer greater than or equal to the value.',
  },
  {
    name: 'sqrt',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the square root of a number.',
  },
  {
    name: 'pow',
    parameters: [{ label: 'base: number' }, { label: 'exponent: number' }],
    returnType: 'number',
    documentation: 'Returns base raised to the power of exponent.',
  },
  {
    name: 'power',
    parameters: [{ label: 'base: number' }, { label: 'exponent: number' }],
    returnType: 'number',
    documentation: 'Returns base raised to the power of exponent.',
  },
  {
    name: 'mod',
    parameters: [{ label: 'dividend: number' }, { label: 'divisor: number' }],
    returnType: 'number',
    documentation: 'Returns the remainder of dividend divided by divisor.',
  },
  {
    name: 'log',
    parameters: [
      { label: 'value: number' },
      { label: 'base: number', documentation: 'Optional logarithm base. With one argument, returns the natural log.' },
    ],
    returnType: 'number',
    documentation: 'Returns the natural logarithm, or the logarithm to the given base.',
  },
  {
    name: 'log10',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the base-10 logarithm of a number.',
  },
  {
    name: 'exp',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns e raised to the power of the value.',
  },
  {
    name: 'sign',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns -1, 0, or 1 depending on the sign of the value.',
  },
  {
    name: 'ln',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the natural logarithm of a number.',
  },
  {
    name: 'truncate',
    parameters: [{ label: 'value: number' }, { label: 'decimals: number', documentation: 'Number of decimal places.' }],
    returnType: 'number',
    documentation: 'Truncates a number to the given number of decimal places.',
  },

  // Trigonometric
  {
    name: 'sin',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the sine of the value (in radians).',
  },
  {
    name: 'cos',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the cosine of the value (in radians).',
  },
  {
    name: 'tan',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the tangent of the value (in radians).',
  },
  {
    name: 'asin',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the arc sine of the value (in radians).',
  },
  {
    name: 'acos',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the arc cosine of the value (in radians).',
  },
  {
    name: 'atan',
    parameters: [{ label: 'value: number' }],
    returnType: 'number',
    documentation: 'Returns the arc tangent of the value (in radians).',
  },
  {
    name: 'atan2',
    parameters: [{ label: 'y: number' }, { label: 'x: number' }],
    returnType: 'number',
    documentation: 'Returns the arc tangent of y / x, using the signs of both to determine the quadrant.',
  },
  {
    name: 'rand',
    parameters: [{ label: 'seed: number', documentation: 'Optional seed for a repeatable sequence.' }],
    returnType: 'number',
    documentation: 'Returns a random floating-point value between 0 and 1.',
  },
  {
    name: 'pi',
    parameters: [],
    returnType: 'number',
    documentation: 'Returns the value of pi.',
  },

  // Strings
  {
    name: 'concat',
    parameters: [{ label: 'value: any' }, { label: '...values: any', documentation: 'Additional values to append.' }],
    returnType: 'string',
    documentation: 'Concatenates the arguments into a single string.',
  },
  {
    name: 'length',
    parameters: [{ label: 'value: string' }],
    returnType: 'number',
    documentation: 'Returns the length of the string in bytes.',
  },
  {
    name: 'char_length',
    parameters: [{ label: 'value: string' }],
    returnType: 'number',
    documentation: 'Returns the length of the string in characters.',
  },
  {
    name: 'lower',
    parameters: [{ label: 'value: string' }],
    returnType: 'string',
    documentation: 'Returns the string with all characters in lower case.',
  },
  {
    name: 'upper',
    parameters: [{ label: 'value: string' }],
    returnType: 'string',
    documentation: 'Returns the string with all characters in upper case.',
  },
  {
    name: 'substring',
    parameters: [
      { label: 'value: string' },
      { label: 'start: number', documentation: 'One-based start position.' },
      { label: 'length: number', documentation: 'Optional number of characters.' },
    ],
    returnType: 'string',
    documentation: 'Extracts a substring starting at the given position.',
  },
  {
    name: 'substring_index',
    parameters: [
      { label: 'value: string' },
      { label: 'delimiter: string' },
      {
        label: 'count: number',
        documentation: 'Occurrences of the delimiter to include (negative counts from the end).',
      },
    ],
    returnType: 'string',
    documentation: 'Returns the substring before the given count of delimiter occurrences.',
  },
  {
    name: 'left',
    parameters: [{ label: 'value: string' }, { label: 'length: number' }],
    returnType: 'string',
    documentation: 'Returns the leftmost length characters of the string.',
  },
  {
    name: 'right',
    parameters: [{ label: 'value: string' }, { label: 'length: number' }],
    returnType: 'string',
    documentation: 'Returns the rightmost length characters of the string.',
  },
  {
    name: 'ltrim',
    parameters: [{ label: 'value: string' }],
    returnType: 'string',
    documentation: 'Returns the string with leading spaces removed.',
  },
  {
    name: 'rtrim',
    parameters: [{ label: 'value: string' }],
    returnType: 'string',
    documentation: 'Returns the string with trailing spaces removed.',
  },
  {
    name: 'replace',
    parameters: [{ label: 'value: string' }, { label: 'from: string' }, { label: 'to: string' }],
    returnType: 'string',
    documentation: 'Replaces all occurrences of from with to in the string.',
  },
  {
    name: 'reverse',
    parameters: [{ label: 'value: string' }],
    returnType: 'string',
    documentation: 'Returns the string with the characters in reverse order.',
  },
  {
    name: 'lcase',
    parameters: [{ label: 'value: string' }],
    returnType: 'string',
    documentation: 'Returns the string with all characters in lower case.',
  },
  {
    name: 'ucase',
    parameters: [{ label: 'value: string' }],
    returnType: 'string',
    documentation: 'Returns the string with all characters in upper case.',
  },
  {
    name: 'mid',
    parameters: [
      { label: 'value: string' },
      { label: 'start: number', documentation: 'One-based start position.' },
      { label: 'length: number', documentation: 'Number of characters.' },
    ],
    returnType: 'string',
    documentation: 'Extracts a substring starting at the given position.',
  },
  {
    name: 'repeat',
    parameters: [{ label: 'value: string' }, { label: 'count: number' }],
    returnType: 'string',
    documentation: 'Returns the string repeated count times.',
  },
  {
    name: 'position',
    parameters: [{ label: 'substring: string' }, { label: 'string: string' }],
    returnType: 'number',
    documentation: 'Returns the position of substring within string. Syntax: POSITION(substring IN string).',
  },
  {
    name: 'instr',
    parameters: [{ label: 'string: string' }, { label: 'substring: string' }],
    returnType: 'number',
    documentation: 'Returns the position of the first occurrence of substring in string.',
  },
  {
    name: 'locate',
    parameters: [
      { label: 'substring: string' },
      { label: 'string: string' },
      { label: 'start: number', documentation: 'Optional one-based position to start searching from.' },
    ],
    returnType: 'number',
    documentation: 'Returns the position of the first occurrence of substring in string.',
  },
  {
    name: 'ascii',
    parameters: [{ label: 'value: string' }],
    returnType: 'number',
    documentation: 'Returns the numeric ASCII code of the leftmost character.',
  },
  {
    name: 'ord',
    parameters: [{ label: 'value: string' }],
    returnType: 'number',
    documentation: 'Returns the numeric code of the leftmost character (multi-byte aware).',
  },
  {
    name: 'char',
    parameters: [
      { label: 'code: number' },
      { label: '...codes: number', documentation: 'Additional character codes.' },
    ],
    returnType: 'string',
    documentation: 'Returns a string built from the given numeric character codes.',
  },
  {
    name: 'regexp_substr',
    parameters: [{ label: 'value: string' }, { label: 'pattern: string' }],
    returnType: 'string',
    documentation: 'Returns the substring matching the regular expression pattern.',
  },

  // Date / time
  {
    name: 'str_to_date',
    parameters: [{ label: 'value: string' }, { label: 'format: string' }],
    returnType: 'datetime',
    documentation: 'Parses a string into a date/time using the given format.',
  },
  {
    name: 'date_format',
    parameters: [{ label: 'date: datetime' }, { label: 'format: string' }],
    returnType: 'string',
    documentation: 'Formats a date/time value using the given format string.',
  },
  {
    name: 'date_add',
    parameters: [{ label: 'date: datetime' }, { label: 'interval: any' }],
    returnType: 'datetime',
    documentation: 'Adds a time interval to a date. Syntax: DATE_ADD(date, INTERVAL expr unit).',
  },
  {
    name: 'date_sub',
    parameters: [{ label: 'date: datetime' }, { label: 'interval: any' }],
    returnType: 'datetime',
    documentation: 'Subtracts a time interval from a date. Syntax: DATE_SUB(date, INTERVAL expr unit).',
  },
  {
    name: 'year',
    parameters: [{ label: 'date: datetime' }],
    returnType: 'number',
    documentation: 'Returns the year of the date.',
  },
  {
    name: 'month',
    parameters: [{ label: 'date: datetime' }],
    returnType: 'number',
    documentation: 'Returns the month of the date (1-12).',
  },
  {
    name: 'day',
    parameters: [{ label: 'date: datetime' }],
    returnType: 'number',
    documentation: 'Returns the day of the month (1-31).',
  },
  {
    name: 'weekday',
    parameters: [{ label: 'date: datetime' }],
    returnType: 'number',
    documentation: 'Returns the weekday index of the date (0 = Monday).',
  },
  {
    name: 'datediff',
    parameters: [{ label: 'date1: datetime' }, { label: 'date2: datetime' }],
    returnType: 'number',
    documentation: 'Returns the number of days between date1 and date2.',
  },
  {
    name: 'unix_timestamp',
    parameters: [{ label: 'date: datetime', documentation: 'Optional; defaults to the current time.' }],
    returnType: 'number',
    documentation: 'Returns the Unix timestamp (seconds since the epoch).',
  },
  {
    name: 'from_unixtime',
    parameters: [{ label: 'timestamp: number' }, { label: 'format: string', documentation: 'Optional format string.' }],
    returnType: 'datetime',
    documentation: 'Converts a Unix timestamp into a date/time value.',
  },
  {
    name: 'extract',
    parameters: [{ label: 'unit: any' }, { label: 'date: datetime' }],
    returnType: 'number',
    documentation: 'Extracts a part from a date. Syntax: EXTRACT(unit FROM date).',
  },
  {
    name: 'hour',
    parameters: [{ label: 'time: datetime' }],
    returnType: 'number',
    documentation: 'Returns the hour of the time value.',
  },
  {
    name: 'minute',
    parameters: [{ label: 'time: datetime' }],
    returnType: 'number',
    documentation: 'Returns the minute of the time value.',
  },
  {
    name: 'second',
    parameters: [{ label: 'time: datetime' }],
    returnType: 'number',
    documentation: 'Returns the second of the time value.',
  },
  {
    name: 'dayname',
    parameters: [{ label: 'date: datetime' }],
    returnType: 'string',
    documentation: 'Returns the name of the weekday for the date.',
  },
  {
    name: 'monthname',
    parameters: [{ label: 'date: datetime' }],
    returnType: 'string',
    documentation: 'Returns the name of the month for the date.',
  },
  {
    name: 'dayofweek',
    parameters: [{ label: 'date: datetime' }],
    returnType: 'number',
    documentation: 'Returns the weekday index of the date (1 = Sunday).',
  },
  {
    name: 'dayofmonth',
    parameters: [{ label: 'date: datetime' }],
    returnType: 'number',
    documentation: 'Returns the day of the month (1-31).',
  },
  {
    name: 'dayofyear',
    parameters: [{ label: 'date: datetime' }],
    returnType: 'number',
    documentation: 'Returns the day of the year (1-366).',
  },
  {
    name: 'week',
    parameters: [
      { label: 'date: datetime' },
      { label: 'mode: number', documentation: 'Optional mode controlling how weeks are numbered.' },
    ],
    returnType: 'number',
    documentation: 'Returns the week number of the date.',
  },
  {
    name: 'quarter',
    parameters: [{ label: 'date: datetime' }],
    returnType: 'number',
    documentation: 'Returns the quarter of the year for the date (1-4).',
  },
  {
    name: 'time_to_sec',
    parameters: [{ label: 'time: datetime' }],
    returnType: 'number',
    documentation: 'Converts a time value to the number of seconds.',
  },
  {
    name: 'sec_to_time',
    parameters: [{ label: 'seconds: number' }],
    returnType: 'time',
    documentation: 'Converts a number of seconds to a time value.',
  },
  {
    name: 'timestampdiff',
    parameters: [{ label: 'unit: any' }, { label: 'start: datetime' }, { label: 'end: datetime' }],
    returnType: 'number',
    documentation: 'Returns the difference between two date/times in the given unit.',
  },
  {
    name: 'timestampadd',
    parameters: [{ label: 'unit: any' }, { label: 'interval: number' }, { label: 'date: datetime' }],
    returnType: 'datetime',
    documentation: 'Adds an interval in the given unit to a date/time.',
  },

  // Cast / convert
  {
    name: 'cast',
    parameters: [{ label: 'value: any' }, { label: 'type: any' }],
    returnType: 'any',
    documentation: 'Converts a value to another type. Syntax: CAST(value AS type).',
  },
  {
    name: 'convert',
    parameters: [{ label: 'value: any' }, { label: 'type: any' }],
    returnType: 'any',
    documentation: 'Converts a value to another type or character set. Syntax: CONVERT(value, type).',
  },

  // JSON
  {
    name: 'json_extract',
    parameters: [
      { label: 'json: string' },
      { label: 'path: string' },
      { label: '...paths: string', documentation: 'Additional JSON paths.' },
    ],
    returnType: 'any',
    documentation: 'Returns the data from a JSON document matching the given path(s).',
  },
  {
    name: 'json_object',
    parameters: [
      { label: 'key: string' },
      { label: 'value: any' },
      { label: '...pairs: any', documentation: 'Additional key/value pairs.' },
    ],
    returnType: 'string',
    documentation: 'Builds a JSON object from the given key/value pairs.',
  },
  {
    name: 'json_array',
    parameters: [{ label: 'value: any' }, { label: '...values: any', documentation: 'Additional array elements.' }],
    returnType: 'string',
    documentation: 'Builds a JSON array from the given values.',
  },
  {
    name: 'json_merge_patch',
    parameters: [
      { label: 'json: string' },
      { label: 'patch: string' },
      { label: '...patches: string', documentation: 'Additional patch documents.' },
    ],
    returnType: 'string',
    documentation: 'Merges JSON documents following RFC 7396 semantics.',
  },
  {
    name: 'json_valid',
    parameters: [{ label: 'value: string' }],
    returnType: 'number',
    documentation: 'Returns 1 if the value is valid JSON, otherwise 0.',
  },
  {
    name: 'json_contains',
    parameters: [
      { label: 'target: string' },
      { label: 'candidate: string' },
      { label: 'path: string', documentation: 'Optional path within the target.' },
    ],
    returnType: 'number',
    documentation: 'Returns 1 if the target JSON contains the candidate, otherwise 0.',
  },
  {
    name: 'json_length',
    parameters: [
      { label: 'json: string' },
      { label: 'path: string', documentation: 'Optional path within the document.' },
    ],
    returnType: 'number',
    documentation: 'Returns the number of elements in a JSON document or path.',
  },
  {
    name: 'json_type',
    parameters: [{ label: 'json: string' }],
    returnType: 'string',
    documentation: 'Returns the type of a JSON value as a string.',
  },
  {
    name: 'json_keys',
    parameters: [
      { label: 'json: string' },
      { label: 'path: string', documentation: 'Optional path within the document.' },
    ],
    returnType: 'string',
    documentation: 'Returns the keys of a JSON object as a JSON array.',
  },
  {
    name: 'json_search',
    parameters: [
      { label: 'json: string' },
      { label: 'one_or_all: string', documentation: "Either 'one' or 'all'." },
      { label: 'search: string' },
    ],
    returnType: 'string',
    documentation: 'Returns the path(s) to values matching the search string.',
  },
  {
    name: 'json_quote',
    parameters: [{ label: 'value: string' }],
    returnType: 'string',
    documentation: 'Quotes a string as a JSON value, escaping as needed.',
  },
  {
    name: 'json_unquote',
    parameters: [{ label: 'value: string' }],
    returnType: 'string',
    documentation: 'Unquotes a JSON value and returns it as a string.',
  },
  {
    name: 'json_set',
    parameters: [{ label: 'json: string' }, { label: 'path: string' }, { label: 'value: any' }],
    returnType: 'string',
    documentation: 'Inserts or updates data in a JSON document at the given path.',
  },
  {
    name: 'json_insert',
    parameters: [{ label: 'json: string' }, { label: 'path: string' }, { label: 'value: any' }],
    returnType: 'string',
    documentation: 'Inserts data into a JSON document without overwriting existing values.',
  },
  {
    name: 'json_replace',
    parameters: [{ label: 'json: string' }, { label: 'path: string' }, { label: 'value: any' }],
    returnType: 'string',
    documentation: 'Replaces existing values in a JSON document at the given path.',
  },
  {
    name: 'json_remove',
    parameters: [
      { label: 'json: string' },
      { label: 'path: string' },
      { label: '...paths: string', documentation: 'Additional paths to remove.' },
    ],
    returnType: 'string',
    documentation: 'Removes data from a JSON document at the given path(s).',
  },
];
