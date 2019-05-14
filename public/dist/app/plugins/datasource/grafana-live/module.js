import * as tslib_1 from "tslib";
import { GrafanaStreamDS } from './datasource';
import { QueryCtrl } from 'app/plugins/sdk';
var GrafanaQueryCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(GrafanaQueryCtrl, _super);
    function GrafanaQueryCtrl() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    GrafanaQueryCtrl.templateUrl = 'partials/query.editor.html';
    return GrafanaQueryCtrl;
}(QueryCtrl));
export { GrafanaStreamDS as Datasource, GrafanaQueryCtrl as QueryCtrl };
//# sourceMappingURL=module.js.map