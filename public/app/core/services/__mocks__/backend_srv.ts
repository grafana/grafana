import 'whatwg-fetch'; // fetch polyfill needed for Headers

import { BackendSrvRequest, FetchResponse } from '@grafana/runtime';
import { of } from 'rxjs';
import { BackendSrv } from '../backend_srv';

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

export const backendSrv = ({
  get: jest.fn(),
  getDashboardByUid: jest.fn(),
  getFolderByUid: jest.fn(),
  post: jest.fn(),
  resolveCancelerIfExists: jest.fn(),
  datasourceRequest: jest.fn(() => Promise.resolve(makePromResponse())),

  // Observable support
  fetch: (options: BackendSrvRequest) => {
    return of(makePromResponse() as FetchResponse);
  },
} as unknown) as BackendSrv;

export const getBackendSrv = jest.fn().mockReturnValue(backendSrv);
