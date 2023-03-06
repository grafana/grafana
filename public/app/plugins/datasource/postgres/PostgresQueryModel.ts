import { ScopedVars } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';
import { FormatRegistryID } from '@grafana/scenes';
import { applyQueryDefaults } from 'app/features/plugins/sql/defaults';
import { SQLQuery, SqlQueryModel } from 'app/features/plugins/sql/types';

export class PostgresQueryModel implements SqlQueryModel {
  target: SQLQuery;
  templateSrv?: TemplateSrv;
  scopedVars?: ScopedVars;

  constructor(target?: SQLQuery, templateSrv?: TemplateSrv, scopedVars?: ScopedVars) {
    this.target = applyQueryDefaults(target || { refId: 'A' });
    this.templateSrv = templateSrv;
    this.scopedVars = scopedVars;
  }

  interpolate() {
    return this.templateSrv?.replace(this.target.rawSql, this.scopedVars, FormatRegistryID.sqlString) || '';
  }

  quoteLiteral(value: string) {
    return "'" + value.replace(/'/g, "''") + "'";
  }
}
