import { __read, __spreadArray } from "tslib";
import { DashboardPicker } from './DashboardPicker';
import { getStandardOptionEditors } from '@grafana/ui';
/**
 * Returns collection of standard option editors definitions
 */
export var getAllOptionEditors = function () {
    var dashboardPicker = {
        id: 'dashboard-uid',
        name: 'Dashboard',
        description: 'Select dashboard',
        editor: DashboardPicker,
    };
    return __spreadArray(__spreadArray([], __read(getStandardOptionEditors()), false), [dashboardPicker], false);
};
//# sourceMappingURL=registry.js.map