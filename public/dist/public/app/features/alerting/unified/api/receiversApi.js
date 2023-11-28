import { __awaiter } from "tslib";
import { CONTACT_POINTS_STATE_INTERVAL_MS } from '../utils/constants';
import { alertingApi } from './alertingApi';
import { fetchContactPointsState } from './grafana';
export const receiversApi = alertingApi.injectEndpoints({
    endpoints: (build) => ({
        contactPointsState: build.query({
            queryFn: ({ amSourceName }) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const contactPointsState = yield fetchContactPointsState(amSourceName);
                    return { data: contactPointsState };
                }
                catch (error) {
                    return { error: error };
                }
            }),
        }),
    }),
});
export const useGetContactPointsState = (alertManagerSourceName) => {
    const contactPointsStateEmpty = { receivers: {}, errorCount: 0 };
    const { currentData: contactPointsState } = receiversApi.useContactPointsStateQuery({ amSourceName: alertManagerSourceName !== null && alertManagerSourceName !== void 0 ? alertManagerSourceName : '' }, {
        skip: !alertManagerSourceName,
        pollingInterval: CONTACT_POINTS_STATE_INTERVAL_MS,
    });
    return contactPointsState !== null && contactPointsState !== void 0 ? contactPointsState : contactPointsStateEmpty;
};
//# sourceMappingURL=receiversApi.js.map