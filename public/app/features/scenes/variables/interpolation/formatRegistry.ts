import { isArray, map, replace } from 'lodash';

import { dateTime, Registry, RegistryItem, textUtil } from '@grafana/data';
import kbn from 'app/core/utils/kbn';
import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { VariableValue, VariableValueSingle } from '../types';

export interface FormatRegistryItem extends RegistryItem {
  formatter(value: VariableValue, args: string[], variable: FormatVariable): string;
}

/**
 * Slimmed down version of the SceneVariable interface so that it only contains what the formatters actually use.
 * This is useful as we have some implementations of this interface that does not need to be full scene objects.
 * For example ScopedVarsVariable and LegacyVariableWrapper.
 */
export interface FormatVariable {
  state: {
    name: string;
  };

  getValue(fieldPath?: string): VariableValue | undefined | null;
  getValueText?(fieldPath?: string): string;
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
      formatter: (value) => {
        if (typeof value === 'string') {
          return luceneEscape(value);
        }

        if (Array.isArray(value)) {
          if (value.length === 0) {
            return '__empty__';
          }
          const quotedValues = map(value, (val: string) => {
            return '"' + luceneEscape(val) + '"';
          });
          return '(' + quotedValues.join(' OR ') + ')';
        } else {
          return luceneEscape(`${value}`);
        }
      },
    },
    {
      id: FormatRegistryID.raw,
      name: 'raw',
      description: 'Keep value as is',
      formatter: (value) => String(value),
    },
    {
      id: FormatRegistryID.regex,
      name: 'Regex',
      description: 'Values are regex escaped and multi-valued variables generate a (<value>|<value>) expression',
      formatter: (value) => {
        if (typeof value === 'string') {
          return kbn.regexEscape(value);
        }

        if (Array.isArray(value)) {
          const escapedValues = value.map((item) => {
            if (typeof item === 'string') {
              return kbn.regexEscape(item);
            } else {
              return kbn.regexEscape(String(item));
            }
          });

          if (escapedValues.length === 1) {
            return escapedValues[0];
          }

          return '(' + escapedValues.join('|') + ')';
        }

        return kbn.regexEscape(`${value}`);
      },
    },
    {
      id: FormatRegistryID.pipe,
      name: 'Pipe',
      description: 'Values are separated by | character',
      formatter: (value) => {
        if (typeof value === 'string') {
          return value;
        }

        if (Array.isArray(value)) {
          return value.join('|');
        }

        return `${value}`;
      },
    },
    {
      id: FormatRegistryID.distributed,
      name: 'Distributed',
      description: 'Multiple values are formatted like variable=value',
      formatter: (value, args, variable) => {
        if (typeof value === 'string') {
          return value;
        }

        if (Array.isArray(value)) {
          value = map(value, (val: string, index: number) => {
            if (index !== 0) {
              return variable.state.name + '=' + val;
            } else {
              return val;
            }
          });

          return value.join(',');
        }

        return `${value}`;
      },
    },
    {
      id: FormatRegistryID.csv,
      name: 'Csv',
      description: 'Comma-separated values',
      formatter: (value) => {
        if (typeof value === 'string') {
          return value;
        }

        if (isArray(value)) {
          return value.join(',');
        }

        return String(value);
      },
    },
    {
      id: FormatRegistryID.html,
      name: 'HTML',
      description: 'HTML escaping of values',
      formatter: (value) => {
        if (typeof value === 'string') {
          return textUtil.escapeHtml(value);
        }

        if (isArray(value)) {
          return textUtil.escapeHtml(value.join(', '));
        }

        return textUtil.escapeHtml(String(value));
      },
    },
    {
      id: FormatRegistryID.json,
      name: 'JSON',
      description: 'JSON stringify value',
      formatter: (value) => {
        return JSON.stringify(value);
      },
    },
    {
      id: FormatRegistryID.percentEncode,
      name: 'Percent encode',
      description: 'Useful for URL escaping values',
      formatter: (value) => {
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
      formatter: (value) => {
        // escape single quotes with backslash
        const regExp = new RegExp(`'`, 'g');

        if (isArray(value)) {
          return map(value, (v: string) => `'${replace(v, regExp, `\\'`)}'`).join(',');
        }

        let strVal = typeof value === 'string' ? value : String(value);
        return `'${replace(strVal, regExp, `\\'`)}'`;
      },
    },
    {
      id: FormatRegistryID.doubleQuote,
      name: 'Double quote',
      description: 'Double quoted values',
      formatter: (value) => {
        // escape double quotes with backslash
        const regExp = new RegExp('"', 'g');
        if (isArray(value)) {
          return map(value, (v: string) => `"${replace(v, regExp, '\\"')}"`).join(',');
        }

        let strVal = typeof value === 'string' ? value : String(value);
        return `"${replace(strVal, regExp, '\\"')}"`;
      },
    },
    {
      id: FormatRegistryID.sqlString,
      name: 'SQL string',
      description: 'SQL string quoting and commas for use in IN statements and other scenarios',
      formatter: (value) => {
        // escape single quotes by pairing them
        const regExp = new RegExp(`'`, 'g');
        if (isArray(value)) {
          return map(value, (v: string) => `'${replace(v, regExp, "''")}'`).join(',');
        }

        let strVal = typeof value === 'string' ? value : String(value);
        return `'${replace(strVal, regExp, "''")}'`;
      },
    },
    {
      id: FormatRegistryID.date,
      name: 'Date',
      description: 'Format date in different ways',
      formatter: (value, args) => {
        let nrValue = NaN;

        if (typeof value === 'number') {
          nrValue = value;
        } else if (typeof value === 'string') {
          nrValue = parseInt(value, 10);
        }

        if (isNaN(nrValue)) {
          return 'NaN';
        }

        const arg = args[0] ?? 'iso';
        switch (arg) {
          case 'ms':
            return String(value);
          case 'seconds':
            return `${Math.round(nrValue! / 1000)}`;
          case 'iso':
            return dateTime(nrValue).toISOString();
          default:
            return dateTime(nrValue).format(arg);
        }
      },
    },
    {
      id: FormatRegistryID.glob,
      name: 'Glob',
      description: 'Format multi-valued variables using glob syntax, example {value1,value2}',
      formatter: (value) => {
        if (isArray(value) && value.length > 1) {
          return '{' + value.join(',') + '}';
        }
        return String(value);
      },
    },
    {
      id: FormatRegistryID.text,
      name: 'Text',
      description: 'Format variables in their text representation. Example in multi-variable scenario A + B + C.',
      formatter: (value, _args, variable) => {
        if (variable.getValueText) {
          return variable.getValueText();
        }

        return String(value);
      },
    },
    {
      id: FormatRegistryID.queryParam,
      name: 'Query parameter',
      description:
        'Format variables as URL parameters. Example in multi-variable scenario A + B + C => var-foo=A&var-foo=B&var-foo=C.',
      formatter: (value, _args, variable) => {
        if (Array.isArray(value)) {
          return value.map((v) => formatQueryParameter(variable.state.name, v)).join('&');
        }
        return formatQueryParameter(variable.state.name, value);
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
function encodeURIComponentStrict(str: VariableValueSingle) {
  if (typeof str === 'object') {
    str = String(str);
  }

  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase();
  });
}

function formatQueryParameter(name: string, value: VariableValueSingle): string {
  return `var-${name}=${encodeURIComponentStrict(value)}`;
}

export function isAllValue(value: VariableValueSingle) {
  return value === ALL_VARIABLE_VALUE || (Array.isArray(value) && value[0] === ALL_VARIABLE_VALUE);
}
