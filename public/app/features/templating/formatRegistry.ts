import { isArray, map, replace } from 'lodash';

import { dateTime, Registry, RegistryItem, textUtil, TypedVariableModel } from '@grafana/data';
import kbn from 'app/core/utils/kbn';

import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../variables/constants';
import { formatVariableLabel } from '../variables/shared/formatVariable';

export interface FormatOptions {
  value: any;
  text: string;
  args: string[];
}

export interface FormatRegistryItem extends RegistryItem {
  formatter(options: FormatOptions, variable: TypedVariableModel): string;
}

export enum FormatRegistryID {
  lucene = 'lucene',
  raw = 'raw',
  regex = 'regex',
  pipe = 'pipe',
  distributed = 'distributed',
  csv = 'csv',
  html = 'html',
  json = 'json',
  percentEncode = 'percentencode',
  singleQuote = 'singlequote',
  doubleQuote = 'doublequote',
  sqlString = 'sqlstring',
  date = 'date',
  glob = 'glob',
  text = 'text',
  queryParam = 'queryparam',
}

export const formatRegistry = new Registry<FormatRegistryItem>(() => {
  const formats: FormatRegistryItem[] = [
    {
      id: FormatRegistryID.lucene,
      name: 'Lucene',
      description: 'Values are lucene escaped and multi-valued variables generate an OR expression',
      formatter: ({ value }) => {
        if (typeof value === 'string') {
          return luceneEscape(value);
        }

        if (value instanceof Array && value.length === 0) {
          return '__empty__';
        }

        const quotedValues = map(value, (val: string) => {
          return '"' + luceneEscape(val) + '"';
        });

        return '(' + quotedValues.join(' OR ') + ')';
      },
    },
    {
      id: FormatRegistryID.raw,
      name: 'raw',
      description: 'Keep value as is',
      formatter: ({ value }) => value,
    },
    {
      id: FormatRegistryID.regex,
      name: 'Regex',
      description: 'Values are regex escaped and multi-valued variables generate a (<value>|<value>) expression',
      formatter: ({ value }) => {
        if (typeof value === 'string') {
          return kbn.regexEscape(value);
        }

        const escapedValues = map(value, kbn.regexEscape);
        if (escapedValues.length === 1) {
          return escapedValues[0];
        }
        return '(' + escapedValues.join('|') + ')';
      },
    },
    {
      id: FormatRegistryID.pipe,
      name: 'Pipe',
      description: 'Values are separated by | character',
      formatter: ({ value }) => {
        if (typeof value === 'string') {
          return value;
        }
        return value.join('|');
      },
    },
    {
      id: FormatRegistryID.distributed,
      name: 'Distributed',
      description: 'Multiple values are formatted like variable=value',
      formatter: ({ value }, variable) => {
        if (typeof value === 'string') {
          return value;
        }

        value = map(value, (val: any, index: number) => {
          if (index !== 0) {
            return variable.name + '=' + val;
          } else {
            return val;
          }
        });
        return value.join(',');
      },
    },
    {
      id: FormatRegistryID.csv,
      name: 'Csv',
      description: 'Comma-separated values',
      formatter: ({ value }) => {
        if (isArray(value)) {
          return value.join(',');
        }
        return value;
      },
    },
    {
      id: FormatRegistryID.html,
      name: 'HTML',
      description: 'HTML escaping of values',
      formatter: ({ value }) => {
        if (isArray(value)) {
          return textUtil.escapeHtml(value.join(', '));
        }
        return textUtil.escapeHtml(value);
      },
    },
    {
      id: FormatRegistryID.json,
      name: 'JSON',
      description: 'JSON stringify valu',
      formatter: ({ value }) => {
        return JSON.stringify(value);
      },
    },
    {
      id: FormatRegistryID.percentEncode,
      name: 'Percent encode',
      description: 'Useful for URL escaping values',
      formatter: ({ value }) => {
        // like glob, but url escaped
        if (isArray(value)) {
          return encodeURIComponentStrict('{' + value.join(',') + '}');
        }
        return encodeURIComponentStrict(value);
      },
    },
    {
      id: FormatRegistryID.singleQuote,
      name: 'Single quote',
      description: 'Single quoted values',
      formatter: ({ value }) => {
        // escape single quotes with backslash
        const regExp = new RegExp(`'`, 'g');
        if (isArray(value)) {
          return map(value, (v: string) => `'${replace(v, regExp, `\\'`)}'`).join(',');
        }
        return `'${replace(value, regExp, `\\'`)}'`;
      },
    },
    {
      id: FormatRegistryID.doubleQuote,
      name: 'Double quote',
      description: 'Double quoted values',
      formatter: ({ value }) => {
        // escape double quotes with backslash
        const regExp = new RegExp('"', 'g');
        if (isArray(value)) {
          return map(value, (v: string) => `"${replace(v, regExp, '\\"')}"`).join(',');
        }
        return `"${replace(value, regExp, '\\"')}"`;
      },
    },
    {
      id: FormatRegistryID.sqlString,
      name: 'SQL string',
      description: 'SQL string quoting and commas for use in IN statements and other scenarios',
      formatter: ({ value }) => {
        // escape single quotes by pairing them
        const regExp = new RegExp(`'`, 'g');
        if (isArray(value)) {
          return map(value, (v) => `'${replace(v, regExp, "''")}'`).join(',');
        }
        return `'${replace(value, regExp, "''")}'`;
      },
    },
    {
      id: FormatRegistryID.date,
      name: 'Date',
      description: 'Format date in different ways',
      formatter: ({ value, args }) => {
        const arg = args[0] ?? 'iso';

        switch (arg) {
          case 'ms':
            return value;
          case 'seconds':
            return `${Math.round(parseInt(value, 10)! / 1000)}`;
          case 'iso':
            return dateTime(parseInt(value, 10)).toISOString();
          default:
            return dateTime(parseInt(value, 10)).format(arg);
        }
      },
    },
    {
      id: FormatRegistryID.glob,
      name: 'Glob',
      description: 'Format multi-valued variables using glob syntax, example {value1,value2}',
      formatter: ({ value }) => {
        if (isArray(value) && value.length > 1) {
          return '{' + value.join(',') + '}';
        }
        return value;
      },
    },
    {
      id: FormatRegistryID.text,
      name: 'Text',
      description: 'Format variables in their text representation. Example in multi-variable scenario A + B + C.',
      formatter: (options, variable) => {
        if (typeof options.text === 'string') {
          return options.value === ALL_VARIABLE_VALUE ? ALL_VARIABLE_TEXT : options.text;
        }

        const current = (variable as any)?.current;

        if (!current) {
          return options.value;
        }

        return formatVariableLabel(variable);
      },
    },
    {
      id: FormatRegistryID.queryParam,
      name: 'Query parameter',
      description:
        'Format variables as URL parameters. Example in multi-variable scenario A + B + C => var-foo=A&var-foo=B&var-foo=C.',
      formatter: (options, variable) => {
        const { value } = options;
        const { name } = variable;

        if (Array.isArray(value)) {
          return value.map((v) => formatQueryParameter(name, v)).join('&');
        }

        return formatQueryParameter(name, value);
      },
    },
  ];

  return formats;
});

function luceneEscape(value: string) {
  if (isNaN(+value) === false) {
    return value;
  }

  return value.replace(/([\!\*\+\-\=<>\s\&\|\(\)\[\]\{\}\^\~\?\:\\/"])/g, '\\$1');
}

/**
 * encode string according to RFC 3986; in contrast to encodeURIComponent()
 * also the sub-delims "!", "'", "(", ")" and "*" are encoded;
 * unicode handling uses UTF-8 as in ECMA-262.
 */
function encodeURIComponentStrict(str: string) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase();
  });
}

function formatQueryParameter(name: string, value: string): string {
  return `var-${name}=${encodeURIComponentStrict(value)}`;
}

export function isAllValue(value: any) {
  return value === ALL_VARIABLE_VALUE || (Array.isArray(value) && value[0] === ALL_VARIABLE_VALUE);
}
