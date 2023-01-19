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

  getDatabase() {
    return this.target.dataset;
  }
}
