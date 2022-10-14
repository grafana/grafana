import { ScopedVars } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';
import { applyQueryDefaults } from 'app/features/plugins/sql/defaults';
import { SQLQuery, SqlQueryModel } from 'app/features/plugins/sql/types';

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
