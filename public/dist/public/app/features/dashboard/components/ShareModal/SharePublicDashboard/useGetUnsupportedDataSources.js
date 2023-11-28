import { __awaiter } from "tslib";
import { useEffect, useState } from 'react';
import { getUnsupportedDashboardDatasources } from './SharePublicDashboardUtils';
export const useGetUnsupportedDataSources = (dashboard) => {
    const [unsupportedDataSources, setUnsupportedDataSources] = useState([]);
    useEffect(() => {
        const fetchUnsupportedDataSources = () => __awaiter(void 0, void 0, void 0, function* () {
            return yield getUnsupportedDashboardDatasources(dashboard.panels);
        });
        fetchUnsupportedDataSources().then((dsList) => {
            setUnsupportedDataSources(dsList);
        });
    }, [dashboard.panels]);
    return { unsupportedDataSources };
};
//# sourceMappingURL=useGetUnsupportedDataSources.js.map