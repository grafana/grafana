import { __rest } from "tslib";
import { useAsyncFn } from 'react-use';
import { lastValueFrom } from 'rxjs';
import { getDataSourceSrv } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';
const toEnrichedCorrelationData = (_a) => {
    var { sourceUID, targetUID } = _a, correlation = __rest(_a, ["sourceUID", "targetUID"]);
    const sourceDatasource = getDataSourceSrv().getInstanceSettings(sourceUID);
    const targetDatasource = getDataSourceSrv().getInstanceSettings(targetUID);
    if (sourceDatasource &&
        (sourceDatasource === null || sourceDatasource === void 0 ? void 0 : sourceDatasource.uid) !== undefined &&
        targetDatasource &&
        targetDatasource.uid !== undefined) {
        return Object.assign(Object.assign({}, correlation), { source: sourceDatasource, target: targetDatasource });
    }
    else {
        return undefined;
    }
};
const validSourceFilter = (correlation) => !!correlation;
export const toEnrichedCorrelationsData = (correlationsResponse) => {
    return Object.assign(Object.assign({}, correlationsResponse), { correlations: correlationsResponse.correlations.map(toEnrichedCorrelationData).filter(validSourceFilter) });
};
export function getData(response) {
    return response.data;
}
/**
 * hook for managing correlations data.
 * TODO: ideally this hook shouldn't have any side effect like showing notifications on error
 * and let consumers handle them. It works nicely with the correlations settings page, but when we'll
 * expose this we'll have to remove those side effects.
 */
export const useCorrelations = () => {
    const { backend } = useGrafana();
    const [getInfo, get] = useAsyncFn((params) => lastValueFrom(backend.fetch({
        url: '/api/datasources/correlations',
        params: { page: params.page },
        method: 'GET',
        showErrorAlert: false,
    }))
        .then(getData)
        .then(toEnrichedCorrelationsData), [backend]);
    const [createInfo, create] = useAsyncFn((_a) => {
        var { sourceUID } = _a, correlation = __rest(_a, ["sourceUID"]);
        return backend
            .post(`/api/datasources/uid/${sourceUID}/correlations`, correlation)
            .then((response) => {
            const enrichedCorrelation = toEnrichedCorrelationData(response.result);
            if (enrichedCorrelation !== undefined) {
                return enrichedCorrelation;
            }
            else {
                throw new Error('invalid sourceUID');
            }
        });
    }, [backend]);
    const [removeInfo, remove] = useAsyncFn(({ sourceUID, uid }) => backend.delete(`/api/datasources/uid/${sourceUID}/correlations/${uid}`), [backend]);
    const [updateInfo, update] = useAsyncFn((_a) => {
        var { sourceUID, uid } = _a, correlation = __rest(_a, ["sourceUID", "uid"]);
        return backend
            .patch(`/api/datasources/uid/${sourceUID}/correlations/${uid}`, correlation)
            .then((response) => {
            const enrichedCorrelation = toEnrichedCorrelationData(response.result);
            if (enrichedCorrelation !== undefined) {
                return enrichedCorrelation;
            }
            else {
                throw new Error('invalid sourceUID');
            }
        });
    }, [backend]);
    return {
        create: Object.assign({ execute: create }, createInfo),
        update: Object.assign({ execute: update }, updateInfo),
        get: Object.assign({ execute: get }, getInfo),
        remove: Object.assign({ execute: remove }, removeInfo),
    };
};
//# sourceMappingURL=useCorrelations.js.map