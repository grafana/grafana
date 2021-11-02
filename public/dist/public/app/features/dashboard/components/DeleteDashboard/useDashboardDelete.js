import { __read } from "tslib";
import { useEffect } from 'react';
import { useAsyncFn } from 'react-use';
import { AppEvents } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { deleteDashboard } from 'app/features/manage-dashboards/state/actions';
import { locationService } from '@grafana/runtime';
export var useDashboardDelete = function (uid) {
    var _a = __read(useAsyncFn(function () { return deleteDashboard(uid, false); }, []), 2), state = _a[0], onDeleteDashboard = _a[1];
    useEffect(function () {
        if (state.value) {
            locationService.replace('/');
            appEvents.emit(AppEvents.alertSuccess, ['Dashboard Deleted', state.value.title + ' has been deleted']);
        }
    }, [state]);
    return { state: state, onDeleteDashboard: onDeleteDashboard };
};
//# sourceMappingURL=useDashboardDelete.js.map