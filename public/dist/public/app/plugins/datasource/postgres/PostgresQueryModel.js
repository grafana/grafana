import { VariableFormatID } from '@grafana/schema';
import { applyQueryDefaults } from 'app/features/plugins/sql/defaults';
export class PostgresQueryModel {
    constructor(target, templateSrv, scopedVars) {
        this.target = applyQueryDefaults(target || { refId: 'A' });
        this.templateSrv = templateSrv;
        this.scopedVars = scopedVars;
    }
    interpolate() {
        var _a;
        return ((_a = this.templateSrv) === null || _a === void 0 ? void 0 : _a.replace(this.target.rawSql, this.scopedVars, VariableFormatID.SQLString)) || '';
    }
    quoteLiteral(value) {
        return "'" + value.replace(/'/g, "''") + "'";
    }
}
//# sourceMappingURL=PostgresQueryModel.js.map