import { __awaiter } from "tslib";
import { getConnectedDashboards as apiGetConnectedDashboards } from '../../state/api';
import { searchCompleted } from './reducer';
export function getConnectedDashboards(libraryPanel) {
    return function (dispatch) {
        return __awaiter(this, void 0, void 0, function* () {
            const dashboards = yield apiGetConnectedDashboards(libraryPanel.uid);
            dispatch(searchCompleted({ dashboards }));
        });
    };
}
//# sourceMappingURL=actions.js.map