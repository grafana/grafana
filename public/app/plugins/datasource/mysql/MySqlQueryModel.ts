import { map } from 'lodash';

import { ScopedVars } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

import { MySQLQuery } from './types';

export default class MySQLQueryModel {
  target: Partial<MySQLQuery>;
  templateSrv?: TemplateSrv;
  scopedVars?: ScopedVars;

  constructor(target: Partial<MySQLQuery>, templateSrv?: TemplateSrv, scopedVars?: ScopedVars) {
    this.target = target;
    this.templateSrv = templateSrv;
    this.scopedVars = scopedVars;
  }

  // remove identifier quoting from identifier to use in metadata queries
  unquoteIdentifier(value: string) {
    if (value[0] === '"' && value[value.length - 1] === '"') {
      return value.substring(1, value.length - 1).replace(/""/g, '"');
    } else {
      return value;
    }
  }

  quoteIdentifier(value: string) {
    return '"' + value.replace(/"/g, '""') + '"';
  }

  quoteLiteral(value: string) {
    return "'" + value.replace(/'/g, "''") + "'";
  }

  escapeLiteral(value: string) {
    return String(value).replace(/'/g, "''");
  }

  format = (value: string, variable: { multi: boolean; includeAll: boolean }) => {
    // if no multi or include all do not regexEscape
    if (!variable.multi && !variable.includeAll) {
      return this.escapeLiteral(value);
    }

    if (typeof value === 'string') {
      return this.quoteLiteral(value);
    }

    const escapedValues = map(value, this.quoteLiteral);
    return escapedValues.join(',');
  };

  interpolate() {
    return this.templateSrv!.replace(this.target.rawSql, this.scopedVars, this.format);
  }

  getDatabase() {
    return this.target.dataset;
  }
}
