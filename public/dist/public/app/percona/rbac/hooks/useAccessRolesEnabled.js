import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';
export const useAccessRolesEnabled = () => {
    const { result: settings } = useSelector(getPerconaSettings);
    return !!(settings === null || settings === void 0 ? void 0 : settings.enableAccessControl);
};
//# sourceMappingURL=useAccessRolesEnabled.js.map