import { useMemo } from 'react';
import { useSelector } from 'app/types';
import { getPerconaSettings } from '../../core/selectors';
export const useShowPMMAddressWarning = () => {
    const { result: settings, loading } = useSelector(getPerconaSettings);
    const showMonitoringWarning = useMemo(() => loading || !(settings === null || settings === void 0 ? void 0 : settings.publicAddress), [settings === null || settings === void 0 ? void 0 : settings.publicAddress, loading]);
    return [showMonitoringWarning];
};
//# sourceMappingURL=showPMMAddressWarning.js.map