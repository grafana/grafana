import { alertingApi } from './alertingApi';
export const stateHistoryApi = alertingApi.injectEndpoints({
    endpoints: (build) => ({
        getRuleHistory: build.query({
            query: ({ ruleUid, from, to, limit = 100 }) => ({
                url: '/api/v1/rules/history',
                params: { ruleUID: ruleUid, from, to, limit },
            }),
        }),
    }),
});
//# sourceMappingURL=stateHistoryApi.js.map