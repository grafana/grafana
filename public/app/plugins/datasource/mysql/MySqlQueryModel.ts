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
  static unquoteIdentifier(value: string) {
    if (value[0] === '"' && value[value.length - 1] === '"') {
      return value.substring(1, value.length - 1).replace(/""/g, '"');
    } else if (value[0] === '`' && value[value.length - 1] === '`') {
      return value.substring(1, value.length - 1);
    } else {
      return value;
    }
  }

  static quoteIdentifier(value: string) {
    return '"' + value.replace(/"/g, '""') + '"';
  }

  static quoteLiteral(value: string) {
    return "'" + value.replace(/'/g, "''") + "'";
  }

  getDatabase() {
    return this.target.dataset;
  }
}
