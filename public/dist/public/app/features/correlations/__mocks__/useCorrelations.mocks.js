import { merge } from 'lodash';
export function createFetchCorrelationsResponse(overrides) {
    return merge({
        data: undefined,
        status: 200,
        url: '',
        config: { url: '' },
        type: 'basic',
        statusText: 'Ok',
        redirected: false,
        headers: {},
        ok: true,
    }, overrides);
}
export function createFetchCorrelationsError(overrides) {
    return merge(createFetchCorrelationsResponse(), {
        status: 500,
        statusText: 'Internal Server Error',
        ok: false,
    }, overrides);
}
export function createCreateCorrelationResponse(correlation) {
    return {
        message: 'Correlation created',
        result: correlation,
    };
}
export function createUpdateCorrelationResponse(correlation) {
    return {
        message: 'Correlation updated',
        result: correlation,
    };
}
export function createRemoveCorrelationResponse() {
    return {
        message: 'Correlation removed',
    };
}
//# sourceMappingURL=useCorrelations.mocks.js.map