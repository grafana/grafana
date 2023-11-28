import { __awaiter } from "tslib";
import { useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { fetchRoleOptions } from './api';
export const useRoleOptions = (organizationId) => {
    const [orgId, setOrgId] = useState(organizationId);
    const { value = [] } = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        if (contextSrv.licensedAccessControlEnabled() && contextSrv.hasPermission(AccessControlAction.ActionRolesList)) {
            return fetchRoleOptions(orgId);
        }
        return Promise.resolve([]);
    }), [orgId]);
    return [{ roleOptions: value }, setOrgId];
};
//# sourceMappingURL=hooks.js.map