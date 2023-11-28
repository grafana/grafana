import { __awaiter } from "tslib";
import React, { useEffect } from 'react';
import { useAsyncFn } from 'react-use';
import { getBackendSrv } from '@grafana/runtime';
import { AsyncSelect } from '@grafana/ui';
export function OrgPicker({ onSelected, className, inputId, autoFocus, excludeOrgs }) {
    // For whatever reason the autoFocus prop doesn't seem to work
    // with AsyncSelect, hence this workaround. Maybe fixed in a later version?
    useEffect(() => {
        var _a;
        if (autoFocus && inputId) {
            (_a = document.getElementById(inputId)) === null || _a === void 0 ? void 0 : _a.focus();
        }
    }, [autoFocus, inputId]);
    const [orgOptionsState, getOrgOptions] = useAsyncFn(() => __awaiter(this, void 0, void 0, function* () {
        const orgs = yield getBackendSrv().get('/api/orgs');
        const allOrgs = orgs.map((org) => ({ value: { id: org.id, name: org.name }, label: org.name }));
        if (excludeOrgs) {
            let idArray = excludeOrgs.map((anOrg) => anOrg.orgId);
            const filteredOrgs = allOrgs.filter((item) => {
                return !idArray.includes(item.value.id);
            });
            return filteredOrgs;
        }
        else {
            return allOrgs;
        }
    }));
    return (React.createElement(AsyncSelect, { inputId: inputId, className: className, isLoading: orgOptionsState.loading, defaultOptions: true, isSearchable: false, loadOptions: getOrgOptions, onChange: onSelected, placeholder: "Select organization", noOptionsMessage: "No organizations found" }));
}
//# sourceMappingURL=OrgPicker.js.map