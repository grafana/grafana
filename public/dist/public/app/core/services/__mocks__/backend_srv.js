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
export var backendSrv = {
    get: jest.fn(),
    getDashboardByUid: jest.fn(),
    getFolderByUid: jest.fn(),
    post: jest.fn(),
    resolveCancelerIfExists: jest.fn(),
    datasourceRequest: jest.fn(function () { return Promise.resolve(makePromResponse()); }),
    // Observable support
    fetch: function (options) {
        return of(makePromResponse());
    },
};
export var getBackendSrv = jest.fn().mockReturnValue(backendSrv);
//# sourceMappingURL=backend_srv.js.map