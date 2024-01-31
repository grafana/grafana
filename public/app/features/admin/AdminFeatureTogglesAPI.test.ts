import { BackendSrvRequest, config } from '@grafana/runtime';

import { getTogglesAPI } from './AdminFeatureTogglesAPI';

// implements @grafana/runtime/BackendSrv
class MockSrv {
  constructor() {
    this.apiCalls = [];
  }

  apiCalls: Array<{
    url: string;
    method: string;
  }>;

  async get(
    url: string,
    params?: BackendSrvRequest['params'],
    requestId?: BackendSrvRequest['requestId'],
    options?: Partial<BackendSrvRequest>
  ) {
    this.apiCalls.push({
      url: url,
      method: 'get',
    });
    if (config.featureToggles.kubernetesFeatureToggles && url.indexOf('current') > -1) {
      return await { toggles: [] };
    }

    return await {};
  }

  async post(url: string, data?: unknown, options?: Partial<BackendSrvRequest>) {
    this.apiCalls.push({
      url: url,
      method: 'post',
    });
    return await {};
  }

  async patch(url: string, data: unknown, options?: Partial<BackendSrvRequest>) {
    this.apiCalls.push({
      url: url,
      method: 'patch',
    });
    return await {};
  }

  // these aren't needed for this test
  async put(url: string, data: unknown, options?: Partial<BackendSrvRequest>) {
    return await {};
  }
  async delete(url: string, data?: unknown, options?: Partial<BackendSrvRequest>) {
    return await {};
  }
}

const testBackendSrv = new MockSrv();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => testBackendSrv,
  config: {
    featureToggles: {
      kubernetesFeatureToggles: false,
      grafanaAPIServerWithExperimentalAPIs: false,
    },
  },
}));

describe('AdminFeatureTogglesApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    testBackendSrv.apiCalls.length = 0;
  });

  const originalToggles = { ...config.featureToggles };

  afterAll(() => {
    config.featureToggles = originalToggles;
  });

  it('uses the k8s api when the k8s toggles are on', async () => {
    config.featureToggles.kubernetesFeatureToggles = true;
    config.featureToggles.grafanaAPIServerWithExperimentalAPIs = true;

    const togglesApi = getTogglesAPI();
    await togglesApi.getFeatureToggles();
    await togglesApi.updateFeatureToggles([]);
    const expected = [
      {
        method: 'get',
        url: '/apis/featuretoggle.grafana.app/v0alpha1/current',
      },
      {
        method: 'patch',
        url: '/apis/featuretoggle.grafana.app/v0alpha1/current',
      },
    ];
    expect(testBackendSrv.apiCalls).toEqual(expect.arrayContaining(expected));
  });
});
