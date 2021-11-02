import { __awaiter, __generator } from "tslib";
import { getConnectedDashboards as apiGetConnectedDashboards } from '../../state/api';
import { searchCompleted } from './reducer';
export function getConnectedDashboards(libraryPanel) {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function () {
            var dashboards;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, apiGetConnectedDashboards(libraryPanel.uid)];
                    case 1:
                        dashboards = _a.sent();
                        dispatch(searchCompleted({ dashboards: dashboards }));
                        return [2 /*return*/];
                }
            });
        });
    };
}
//# sourceMappingURL=actions.js.map