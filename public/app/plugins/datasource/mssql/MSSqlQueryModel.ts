import { type ScopedVars } from '@grafana/data';
import { type TemplateSrv } from '@grafana/runtime';
import { applyQueryDefaults, type SQLQuery, type SqlQueryModel } from '@grafana/sql';

export class MSSqlQueryModel implements SqlQueryModel {
  target: SQLQuery;
  templateSrv?: TemplateSrv;
  scopedVars?: ScopedVars;

  constructor(target?: SQLQuery, templateSrv?: TemplateSrv, scopedVars?: ScopedVars) {
    this.target = applyQueryDefaults(target || { refId: 'A' });
    this.templateSrv = templateSrv;
    this.scopedVars = scopedVars;
  }

  quoteLiteral(value: string) {
    return "'" + value.replace(/'/g, "''") + "'";
  }
}
