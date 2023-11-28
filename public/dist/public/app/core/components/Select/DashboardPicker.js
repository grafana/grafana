import { __awaiter, __rest } from "tslib";
import debounce from 'debounce-promise';
import React, { useCallback, useEffect, useState } from 'react';
import { AsyncSelect } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
const formatLabel = (folderTitle = 'General', dashboardTitle) => `${folderTitle}/${dashboardTitle}`;
function findDashboards(query = '') {
    return __awaiter(this, void 0, void 0, function* () {
        return backendSrv.search({ type: 'dash-db', query, limit: 100 }).then((result) => {
            return result.map((item) => ({
                value: {
                    // dashboards uid here is always defined as this endpoint does not return the default home dashboard
                    uid: item.uid,
                    title: item.title,
                    folderTitle: item.folderTitle,
                    folderUid: item.folderUid,
                },
                label: formatLabel(item === null || item === void 0 ? void 0 : item.folderTitle, item.title),
            }));
        });
    });
}
const getDashboards = debounce(findDashboards, 250, { leading: true });
// TODO: this component should provide a way to apply different filters to the search APIs
export const DashboardPicker = (_a) => {
    var { value, onChange, placeholder = 'Select dashboard', noOptionsMessage = 'No dashboards found' } = _a, props = __rest(_a, ["value", "onChange", "placeholder", "noOptionsMessage"]);
    const [current, setCurrent] = useState();
    // This is required because the async select does not match the raw uid value
    // We can not use a simple Select because the dashboard search should not return *everything*
    useEffect(() => {
        var _a;
        if (!value || value === ((_a = current === null || current === void 0 ? void 0 : current.value) === null || _a === void 0 ? void 0 : _a.uid)) {
            return;
        }
        (() => __awaiter(void 0, void 0, void 0, function* () {
            var _b;
            // value was manually changed from outside or we are rendering for the first time.
            // We need to fetch dashboard information.
            const res = yield backendSrv.getDashboardByUid(value);
            if (res.dashboard) {
                setCurrent({
                    value: {
                        uid: res.dashboard.uid,
                        title: res.dashboard.title,
                        folderTitle: res.meta.folderTitle,
                        folderUid: res.meta.folderUid,
                    },
                    label: formatLabel((_b = res.meta) === null || _b === void 0 ? void 0 : _b.folderTitle, res.dashboard.title),
                });
            }
        }))();
        // we don't need to rerun this effect every time `current` changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);
    const onPicked = useCallback((sel) => {
        setCurrent(sel);
        onChange === null || onChange === void 0 ? void 0 : onChange(sel === null || sel === void 0 ? void 0 : sel.value);
    }, [onChange, setCurrent]);
    return (React.createElement(AsyncSelect, Object.assign({ loadOptions: getDashboards, onChange: onPicked, placeholder: placeholder, noOptionsMessage: noOptionsMessage, value: current, defaultOptions: true }, props)));
};
//# sourceMappingURL=DashboardPicker.js.map