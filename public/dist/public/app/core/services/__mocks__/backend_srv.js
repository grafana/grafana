import 'whatwg-fetch'; // fetch polyfill needed for Headers
import { of } from 'rxjs';
/**
 * Creates a pretty bogus prom response. Definitelly needs more work but right now we do not test the contents of the
 * messages anyway.
 */
function makePromResponse() {
    return {
        data: {
            data: {
                result: [
                    {
                        metric: {
                            __name__: 'test_metric',
                        },
                        values: [[1568369640, 1]],
                    },
                ],
                resultType: 'matrix',
            },
        },
    };
}
export const backendSrv = {
    get: jest.fn(),
    getDashboardByUid: jest.fn(),
    getFolderByUid: jest.fn(),
    post: jest.fn(),
    resolveCancelerIfExists: jest.fn(),
    search: jest.fn(),
    datasourceRequest: jest.fn(() => Promise.resolve(makePromResponse())),
    // Observable support
    fetch: (options) => {
        return of(makePromResponse());
    },
};
export const getBackendSrv = jest.fn().mockReturnValue(backendSrv);
//# sourceMappingURL=backend_srv.js.map