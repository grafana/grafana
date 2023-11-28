import { applyQueryDefaults } from 'app/features/plugins/sql/defaults';
export class MSSqlQueryModel {
    constructor(target, templateSrv, scopedVars) {
        this.target = applyQueryDefaults(target || { refId: 'A' });
        this.templateSrv = templateSrv;
        this.scopedVars = scopedVars;
    }
    quoteLiteral(value) {
        return "'" + value.replace(/'/g, "''") + "'";
    }
}
//# sourceMappingURL=MSSqlQueryModel.js.map