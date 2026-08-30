// Minimal shape for the command/function metadata in this file. Kept local rather than
// imported from @grafana/ui so the CheatSheet tokenizer no longer depends on the Slate-era
// completion types.
interface CompletionItem {
  label: string;
  detail?: string;
  documentation?: string;
}

export const QUERY_COMMANDS: CompletionItem[] = [
  {
    label: 'fields',
    documentation: 'Retrieves the specified fields from log events',
  },
  { label: 'display', documentation: 'Specifies which fields to display in the query results' },
  {
    label: 'filter',
    documentation: 'Filters the results of a query based on one or more conditions',
  },
  {
    label: 'stats',
    documentation: 'Calculates aggregate statistics based on the values of log fields',
  },
  { label: 'sort', documentation: 'Sorts the retrieved log events' },
  { label: 'limit', documentation: 'Specifies the number of log events returned by the query' },
  {
    label: 'parse',
    documentation:
      'Extracts data from a log field, creating one or more ephemeral fields that you can process further in the query',
  },
];

const NUMERIC_OPERATORS = [
  {
    label: 'abs',
    detail: 'abs(a)',
    documentation: 'Absolute value.',
  },
  {
    label: 'ceil',
    detail: 'ceil(a)',
    documentation: 'Round to ceiling (the smallest integer that is greater than the value of a).',
  },
  {
    label: 'floor',
    detail: 'floor(a)',
    documentation: 'Round to floor (the largest integer that is smaller than the value of a).',
  },
  {
    label: 'greatest',
    detail: 'greatest(a,b, ... z)',
    documentation: 'Returns the largest value.',
  },
  {
    label: 'least',
    detail: 'least(a, b, ... z)',
    documentation: 'Returns the smallest value.',
  },
  {
    label: 'log',
    detail: 'log(a)',
    documentation: 'Natural logarithm.',
  },
  {
    label: 'sqrt',
    detail: 'sqrt(a)',
    documentation: 'Square root.',
  },
];

const GENERAL_FUNCTIONS = [
  {
    label: 'ispresent',
    detail: 'ispresent(fieldname)',
    documentation: 'Returns true if the field exists.',
  },
  {
    label: 'coalesce',
    detail: 'coalesce(fieldname1, fieldname2, ... fieldnamex)',
    documentation: 'Returns the first non-null value from the list.',
  },
];

const STRING_FUNCTIONS = [
  {
    label: 'isempty',
    detail: 'isempty(fieldname)',
    documentation: 'Returns true if the field is missing or is an empty string.',
  },
  {
    label: 'isblank',
    detail: 'isblank(fieldname)',
    documentation: 'Returns true if the field is missing, an empty string, or contains only white space.',
  },
  {
    label: 'concat',
    detail: 'concat(string1, string2, ... stringz)',
    documentation: 'Concatenates the strings.',
  },
  {
    label: 'ltrim',
    detail: 'ltrim(string) or ltrim(string1, string2)',
    documentation:
      'Remove white space from the left of the string. If the function has a second string argument, it removes the characters of string2 from the left of string1.',
  },
  {
    label: 'rtrim',
    detail: 'rtrim(string) or rtrim(string1, string2)',
    documentation:
      'Remove white space from the right of the string. If the function has a second string argument, it removes the characters of string2 from the right of string1.',
  },
  {
    label: 'trim',
    detail: 'trim(string) or trim(string1, string2)',
    documentation:
      'Remove white space from both ends of the string. If the function has a second string argument, it removes the characters of string2 from both sides of string1.',
  },
  {
    label: 'strlen',
    detail: 'strlen(string)',
    documentation: 'Returns the length of the string in Unicode code points.',
  },
  {
    label: 'toupper',
    detail: 'toupper(string)',
    documentation: 'Converts the string to uppercase.',
  },
  {
    label: 'tolower',
    detail: 'tolower(string)',
    documentation: 'Converts the string to lowercase.',
  },
  {
    label: 'substr',
    detail: 'substr(string1, x), or substr(string1, x, y)',
    documentation:
      'Returns a substring from the index specified by the number argument to the end of the string. If the function has a second number argument, it contains the length of the substring to be retrieved.',
  },
  {
    label: 'replace',
    detail: 'replace(string1, string2, string3)',
    documentation: 'Replaces all instances of string2 in string1 with string3.',
  },
  {
    label: 'strcontains',
    detail: 'strcontains(string1, string2)',
    documentation: 'Returns 1 if string1 contains string2 and 0 otherwise.',
  },
];

const DATETIME_FUNCTIONS = [
  {
    label: 'bin',
    detail: 'bin(period)',
    documentation: 'Rounds the value of @timestamp to the given period and then truncates.',
  },
  {
    label: 'datefloor',
    detail: 'datefloor(a, period)',
    documentation: 'Truncates the timestamp to the given period.',
  },
  {
    label: 'dateceil',
    detail: 'dateceil(a, period)',
    documentation: 'Rounds up the timestamp to the given period and then truncates.',
  },
  {
    label: 'fromMillis',
    detail: 'fromMillis(fieldname)',
    documentation:
      'Interprets the input field as the number of milliseconds since the Unix epoch and converts it to a timestamp.',
  },
  {
    label: 'toMillis',
    detail: 'toMillis(fieldname)',
    documentation:
      'Converts the timestamp found in the named field into a number representing the milliseconds since the Unix epoch.',
  },
];

const IP_FUNCTIONS = [
  {
    label: 'isValidIp',
    detail: 'isValidIp(fieldname)',
    documentation: 'Returns true if the field is a valid v4 or v6 IP address.',
  },
  {
    label: 'isValidIpV4',
    detail: 'isValidIpV4(fieldname)',
    documentation: 'Returns true if the field is a valid v4 IP address.',
  },
  {
    label: 'isValidIpV6',
    detail: 'isValidIpV6(fieldname)',
    documentation: 'Returns true if the field is a valid v6 IP address.',
  },
  {
    label: 'isIpInSubnet',
    detail: 'isIpInSubnet(fieldname, string)',
    documentation: 'Returns true if the field is a valid v4 or v6 IP address within the specified v4 or v6 subnet.',
  },
  {
    label: 'isIpv4InSubnet',
    detail: 'isIpv4InSubnet(fieldname, string)',
    documentation: 'Returns true if the field is a valid v4 IP address within the specified v4 subnet.',
  },
  {
    label: 'isIpv6InSubnet',
    detail: 'isIpv6InSubnet(fieldname, string)',
    documentation: 'Returns true if the field is a valid v6 IP address within the specified v6 subnet.',
  },
];

const AGGREGATION_FUNCTIONS_STATS = [
  {
    label: 'avg',
    detail: 'avg(NumericFieldname)',
    documentation: 'The average of the values in the specified field.',
  },
  {
    label: 'count',
    detail: 'count(fieldname) or count(*)',
    documentation: 'Counts the log records.',
  },
  {
    label: 'count_distinct',
    detail: 'count_distinct(fieldname)',
    documentation: 'Returns the number of unique values for the field.',
  },
  {
    label: 'max',
    detail: 'max(fieldname)',
    documentation: 'The maximum of the values for this log field in the queried logs.',
  },
  {
    label: 'min',
    detail: 'min(fieldname)',
    documentation: 'The minimum of the values for this log field in the queried logs.',
  },
  {
    label: 'pct',
    detail: 'pct(fieldname, value)',
    documentation: 'A percentile indicates the relative standing of a value in a datas.',
  },
  {
    label: 'stddev',
    detail: 'stddev(NumericFieldname)',
    documentation: 'The standard deviation of the values in the specified field.',
  },
  {
    label: 'sum',
    detail: 'sum(NumericFieldname)',
    documentation: 'The sum of the values in the specified field.',
  },
];

const NON_AGGREGATION_FUNCS_STATS = [
  {
    label: 'earliest',
    detail: 'earliest(fieldname)',
    documentation:
      'Returns the value of fieldName from the log event that has the earliest time stamp in the queried logs.',
  },
  {
    label: 'latest',
    detail: 'latest(fieldname)',
    documentation:
      'Returns the value of fieldName from the log event that has the latest time stamp in the queried logs.',
  },
  {
    label: 'sortsFirst',
    detail: 'sortsFirst(fieldname)',
    documentation: 'Returns the value of fieldName that sorts first in the queried logs.',
  },
  {
    label: 'sortsLast',
    detail: 'sortsLast(fieldname)',
    documentation: 'Returns the value of fieldName that sorts last in the queried logs.',
  },
];

const STATS_FUNCS = [...AGGREGATION_FUNCTIONS_STATS, ...NON_AGGREGATION_FUNCS_STATS];

export const KEYWORDS = ['as', 'like', 'by', 'in', 'desc', 'asc'];
const FIELD_AND_FILTER_FUNCTIONS = [
  ...NUMERIC_OPERATORS,
  ...GENERAL_FUNCTIONS,
  ...STRING_FUNCTIONS,
  ...DATETIME_FUNCTIONS,
  ...IP_FUNCTIONS,
];

export const FUNCTIONS = [...FIELD_AND_FILTER_FUNCTIONS, ...STATS_FUNCS];
