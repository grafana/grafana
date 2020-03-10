import { Grammar } from 'prismjs';
import { CompletionItem } from '@grafana/ui';

export const QUERY_COMMANDS: CompletionItem[] = [
  {
    label: 'fields',
    insertText: 'fields',
    documentation: 'Retrieves the specified fields from log events',
  },
  { label: 'display', insertText: 'display', documentation: 'Specifies which fields to display in the query results' },
  {
    label: 'filter',
    insertText: 'filter',
    documentation: 'Filters the results of a query based on one or more conditions',
  },
  {
    label: 'stats',
    insertText: 'stats',
    documentation: 'Calculates aggregate statistics based on the values of log fields',
  },
  { label: 'sort', insertText: 'sort', documentation: 'Sorts the retrieved log events' },
  { label: 'limit', insertText: 'limit', documentation: 'Specifies the number of log events returned by the query' },
  {
    label: 'parse',
    insertText: 'parse',
    documentation:
      'Extracts data from a log field, creating one or more ephemeral fields that you can process further in the query',
  },
];

export const COMPARISON_OPERATORS = ['=', '!=', '<', '<=', '>', '>='];
export const ARITHMETIC_OPERATORS = ['+', '-', '*', '/', '^', '%'];

export const NUMERIC_OPERATORS = [
  {
    label: 'abs',
    insertText: 'abs',
    detail: 'abs(a)',
    documentation: 'Absolute value.',
  },
  {
    label: 'ceil',
    insertText: 'ceil',
    detail: 'ceil(a)',
    documentation: 'Round to ceiling (the smallest integer that is greater than the value of a).',
  },
  {
    label: 'floor',
    insertText: 'floor',
    detail: 'floor(a)',
    documentation: 'Round to floor (the largest integer that is smaller than the value of a).',
  },
  {
    label: 'greatest',
    insertText: 'greatest',
    detail: 'greatest(a,b, ... z)',
    documentation: 'Returns the largest value.',
  },
  {
    label: 'least',
    insertText: 'least',
    detail: 'least(a, b, ... z)',
    documentation: 'Returns the smallest value.',
  },
  {
    label: 'log',
    insertText: 'log',
    detail: 'log(a)',
    documentation: 'Natural logarithm.',
  },
  {
    label: 'sqrt',
    insertText: 'sqrt',
    detail: 'sqrt(a)',
    documentation: 'Square root.',
  },
];

export const GENERAL_FUNCTIONS = [
  {
    label: 'ispresent',
    insertText: 'ispresent',
    detail: 'ispresent(fieldname)',
    documentation: 'Returns true if the field exists.',
  },
  {
    label: 'coalesce',
    insertText: 'coalesce',
    detail: 'coalesce(fieldname1, fieldname2, ... fieldnamex)',
    documentation: 'Returns the first non-null value from the list.',
  },
];

export const STRING_FUNCTIONS = [
  {
    label: 'isempty',
    insertText: 'isempty',
    detail: 'isempty(fieldname)',
    documentation: 'Returns true if the field is missing or is an empty string.',
  },
  {
    label: 'isblank',
    insertText: 'isblank',
    detail: 'isblank(fieldname)',
    documentation: 'Returns true if the field is missing, an empty string, or contains only white space.',
  },
  {
    label: 'concat',
    insertText: 'concat',
    detail: 'concat(string1, string2, ... stringz)',
    documentation: 'Concatenates the strings.',
  },
  {
    label: 'ltrim',
    insertText: 'ltrim',
    detail: 'ltrim(string) or ltrim(string1, string2)',
    documentation:
      'Remove white space from the left of the string. If the function has a second string argument, it removes the characters of string2 from the left of string1.',
  },
  {
    label: 'rtrim',
    insertText: 'rtrim',
    detail: 'rtrim(string) or rtrim(string1, string2)',
    documentation:
      'Remove white space from the right of the string. If the function has a second string argument, it removes the characters of string2 from the right of string1.',
  },
  {
    label: 'trim',
    insertText: 'trim',
    detail: 'trim(string) or trim(string1, string2)',
    documentation:
      'Remove white space from both ends of the string. If the function has a second string argument, it removes the characters of string2 from both sides of string1.',
  },
  {
    label: 'strlen',
    insertText: 'strlen',
    detail: 'strlen(string)',
    documentation: 'Returns the length of the string in Unicode code points.',
  },
  {
    label: 'toupper',
    insertText: 'toupper',
    detail: 'toupper(string)',
    documentation: 'Converts the string to uppercase.',
  },
  {
    label: 'tolower',
    insertText: 'tolower',
    detail: 'tolower(string)',
    documentation: 'Converts the string to lowercase.',
  },
  {
    label: 'substr',
    insertText: 'substr',
    detail: 'substr(string1, x), or substr(string1, x, y)',
    documentation:
      'Returns a substring from the index specified by the number argument to the end of the string. If the function has a second number argument, it contains the length of the substring to be retrieved.',
  },
  {
    label: 'replace',
    insertText: 'replace',
    detail: 'replace(string1, string2, string3)',
    documentation: 'Replaces all instances of string2 in string1 with string3.',
  },
  {
    label: 'strcontains',
    insertText: 'strcontains',
    detail: 'strcontains(string1, string2)',
    documentation: 'Returns 1 if string1 contains string2 and 0 otherwise.',
  },
];

export const DATETIME_FUNCTIONS = [
  {
    label: 'bin',
    insertText: 'bin',
    detail: 'bin(period)',
    documentation: 'Rounds the value of @timestamp to the given period and then truncates.',
  },
  {
    label: 'datefloor',
    insertText: 'datefloor',
    detail: 'datefloor(a, period)',
    documentation: 'Truncates the timestamp to the given period.',
  },
  {
    label: 'dateceil',
    insertText: 'dateceil',
    detail: 'dateceil(a, period)',
    documentation: 'Rounds up the timestamp to the given period and then truncates.',
  },
  {
    label: 'fromMillis',
    insertText: 'fromMillis',
    detail: 'fromMillis(fieldname)',
    documentation:
      'Interprets the input field as the number of milliseconds since the Unix epoch and converts it to a timestamp.',
  },
  {
    label: 'toMillis',
    insertText: 'toMillis',
    detail: 'toMillis(fieldname)',
    documentation:
      'Converts the timestamp found in the named field into a number representing the milliseconds since the Unix epoch.',
  },
];

export const IP_FUNCTIONS = [
  {
    label: 'isValidIp',
    insertText: 'isValidIp',
    detail: 'isValidIp(fieldname)',
    documentation: 'Returns true if the field is a valid v4 or v6 IP address.',
  },
  {
    label: 'isValidIpV4',
    insertText: 'isValidIpV4',
    detail: 'isValidIpV4(fieldname)',
    documentation: 'Returns true if the field is a valid v4 IP address.',
  },
  {
    label: 'isValidIpV6',
    insertText: 'isValidIpV6',
    detail: 'isValidIpV6(fieldname)',
    documentation: 'Returns true if the field is a valid v6 IP address.',
  },
  {
    label: 'isIpInSubnet',
    insertText: 'isIpInSubnet',
    detail: 'isIpInSubnet(fieldname, string)',
    documentation: 'Returns true if the field is a valid v4 or v6 IP address within the specified v4 or v6 subnet.',
  },
  {
    label: 'isIpv4InSubnet',
    insertText: 'isIpv4InSubnet',
    detail: 'isIpv4InSubnet(fieldname, string)',
    documentation: 'Returns true if the field is a valid v4 IP address within the specified v4 subnet.',
  },
  {
    label: 'isIpv6InSubnet',
    insertText: 'isIpv6InSubnet',
    detail: 'isIpv6InSubnet(fieldname, string)',
    documentation: 'Returns true if the field is a valid v6 IP address within the specified v6 subnet.',
  },
];

export const AGGREGATION_FUNCTIONS_STATS = [
  {
    label: 'avg',
    insertText: 'avg',
    detail: 'avg(NumericFieldname)',
    documentation: 'The average of the values in the specified field.',
  },
  {
    label: 'count',
    insertText: 'count',
    detail: 'count(fieldname) or count(*)',
    documentation: 'Counts the log records.',
  },
  {
    label: 'count_distinct',
    insertText: 'count_distinct',
    detail: 'count_distinct(fieldname)',
    documentation: 'Returns the number of unique values for the field.',
  },
  {
    label: 'max',
    insertText: 'max',
    detail: 'max(fieldname)',
    documentation: 'The maximum of the values for this log field in the queried logs.',
  },
  {
    label: 'min',
    insertText: 'min',
    detail: 'min(fieldname)',
    documentation: 'The minimum of the values for this log field in the queried logs.',
  },
  {
    label: 'pct',
    insertText: 'pct',
    detail: 'pct(fieldname, value)',
    documentation: 'A percentile indicates the relative standing of a value in a datas.',
  },
  {
    label: 'stddev',
    insertText: 'stddev',
    detail: 'stddev(NumericFieldname)',
    documentation: 'The standard deviation of the values in the specified field.',
  },
  {
    label: 'sum',
    insertText: 'sum',
    detail: 'sum(NumericFieldname)',
    documentation: 'The sum of the values in the specified field.',
  },
];

export const NON_AGGREGATION_FUNCS_STATS = [
  {
    label: 'earliest',
    insertText: 'earliest',
    detail: 'earliest(fieldname)',
    documentation:
      'Returns the value of fieldName from the log event that has the earliest time stamp in the queried logs.',
  },
  {
    label: 'latest',
    insertText: 'latest',
    detail: 'latest(fieldname)',
    documentation:
      'Returns the value of fieldName from the log event that has the latest time stamp in the queried logs.',
  },
  {
    label: 'sortsFirst',
    insertText: 'sortsFirst',
    detail: 'sortsFirst(fieldname)',
    documentation: 'Returns the value of fieldName that sorts first in the queried logs.',
  },
  {
    label: 'sortsLast',
    insertText: 'sortsLast',
    detail: 'sortsLast(fieldname)',
    documentation: 'Returns the value of fieldName that sorts last in the queried logs.',
  },
];

export const KEYWORDS = ['as', 'like', 'by', 'in'];
export const FUNCTIONS = [
  ...NUMERIC_OPERATORS,
  ...GENERAL_FUNCTIONS,
  ...STRING_FUNCTIONS,
  ...DATETIME_FUNCTIONS,
  ...IP_FUNCTIONS,
  ...AGGREGATION_FUNCTIONS_STATS,
  ...NON_AGGREGATION_FUNCS_STATS,
];

const tokenizer: Grammar = {
  comment: /^#.*/,
  backticks: {
    pattern: /`.*?`/,
    alias: 'string',
  },
  quote: {
    pattern: /".*?"/,
    alias: 'string',
  },
  regex: {
    pattern: /\/.*?\//,
  },
  'query-command': {
    pattern: new RegExp(`\\b(?:${QUERY_COMMANDS.map(command => command.insertText).join('|')})`, 'i'),
    alias: 'function',
  },
  function: new RegExp(`\\b(?:${FUNCTIONS.map(f => f.insertText).join('|')})(?=\\s*\\()`, 'i'),
  keyword: new RegExp(`\\b(${KEYWORDS.join('|')})\\b`, 'i'),
  'log-group-name': {
    pattern: /[\.\-_/#A-Za-z0-9]+/,
  },
  'field-name': {
    pattern: /([A-Za-z0-9]|`[A-Za-z0-9\-]`)+/,
  },
  number: /\b-?\d+((\.\d*)?([eE][+-]?\d+)?)?\b/,
  punctuation: /[{}()`,.|]/,
};

export default tokenizer;
