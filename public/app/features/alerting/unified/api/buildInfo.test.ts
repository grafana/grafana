import { of, throwError } from 'rxjs';

import { PromApplication, RulesQueryErrorResponse, ThanosFlagsResponse } from 'app/types/unified-alerting-dto';

import { RULER_NOT_SUPPORTED_MSG } from '../utils/constants';

import { discoverDataSourceFeatures } from './buildInfo';
import { fetchRules } from './prometheus';
import { fetchTestRulerRulesGroup } from './ruler';

let fetch = jest.fn();

jest.mock('./prometheus');
jest.mock('./ruler');
jest.mock('app/core/services/context_srv', () => {});
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ fetch }),
}));

const mocks = {
  fetchRules: jest.mocked(fetchRules),
  fetchTestRulerRulesGroup: jest.mocked(fetchTestRulerRulesGroup),
};

beforeEach(() => {
  jest.clearAllMocks();
  fetch.mockClear();
});

describe('discoverDataSourceFeatures', () => {
  describe('When buildinfo returns 404 error', () => {
    it('Should return cortex with ruler API disabled when prom rules works and ruler api returns not avaiable errors', async () => {
      fetch.mockReturnValue(
        throwError(() => ({
          status: 404,
        }))
      );

      mocks.fetchTestRulerRulesGroup.mockRejectedValue({
        status: 404,
        data: {
          message: 'page not found',
        },
      });
      mocks.fetchRules.mockResolvedValue([]);

      const response = await discoverDataSourceFeatures({
        url: '/datasource/proxy',
        name: 'Cortex',
        type: 'prometheus',
      });

      expect(response.application).toBe(PromApplication.Lotex);
      expect(response.features.rulerApiEnabled).toBe(false);

      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledTimes(1);
      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledWith('Cortex');

      expect(mocks.fetchRules).toHaveBeenCalledTimes(1);
      expect(mocks.fetchRules).toHaveBeenCalledWith('Cortex');
    });

    it('Should return cortex with ruler API enabled when prom rules works and ruler api returns cortex error', async () => {
      fetch.mockReturnValue(
        throwError(() => ({
          status: 404,
        }))
      );

      mocks.fetchTestRulerRulesGroup.mockResolvedValue(null);
      mocks.fetchRules.mockResolvedValue([]);

      const response = await discoverDataSourceFeatures({
        url: '/datasource/proxy',
        name: 'Cortex',
        type: 'prometheus',
      });

      expect(response.application).toBe(PromApplication.Lotex);
      expect(response.features.rulerApiEnabled).toBe(true);

      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledTimes(1);
      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledWith('Cortex');

      expect(mocks.fetchRules).toHaveBeenCalledTimes(1);
      expect(mocks.fetchRules).toHaveBeenCalledWith('Cortex');
    });
  });
  describe('When buildinfo returns 200 response', () => {
    it('Should return Prometheus with disabled ruler API when application and features fields are missing', async () => {
      fetch = jest.fn();
      fetch
        .mockReturnValueOnce(
          of({
            data: {
              status: 'success',
              data: {
                version: '2.32.1',
              },
            },
          })
          // For the second call (to thanos flags api) return undefined as this isn't a mock thanos instance
        )
        .mockReturnValueOnce(of(undefined));

      const response = await discoverDataSourceFeatures({
        url: '/datasource/proxy',
        name: 'Prometheus',
        type: 'prometheus',
      });

      expect(response.application).toBe(PromApplication.Prometheus);
      expect(response.features.rulerApiEnabled).toBe(false);
      expect(mocks.fetchRules).not.toHaveBeenCalled();
      expect(mocks.fetchTestRulerRulesGroup).not.toHaveBeenCalled();
    });

    it.each([true, false])(
      `Should return Mimir with rulerApiEnabled set to %p according to the ruler_config_api value`,
      async (rulerApiEnabled) => {
        fetch
          .mockReturnValueOnce(
            of({
              data: {
                status: 'success',
                data: {
                  application: 'Grafana Mimir',
                  version: '2.32.1',
                  features: {
                    // 'true' and 'false' as strings is intentional
                    // This is the format returned from the buildinfo endpoint
                    ruler_config_api: rulerApiEnabled ? 'true' : 'false',
                  },
                },
              },
            })
          )
          .mockReturnValueOnce(of(undefined));

        const response = await discoverDataSourceFeatures({
          url: '/datasource/proxy',
          name: 'Prometheus',
          type: 'prometheus',
        });

        expect(response.application).toBe(PromApplication.Mimir);
        expect(response.features.rulerApiEnabled).toBe(rulerApiEnabled);
        expect(mocks.fetchRules).not.toHaveBeenCalled();
        expect(mocks.fetchTestRulerRulesGroup).not.toHaveBeenCalled();
      }
    );

    it('When the data source is Loki should not call the buildinfo endpoint', async () => {
      mocks.fetchTestRulerRulesGroup.mockResolvedValue(null);
      mocks.fetchRules.mockResolvedValue([]);
      await discoverDataSourceFeatures({ url: '/datasource/proxy', name: 'Loki', type: 'loki' });

      expect(fetch).not.toBeCalled();
    });
    it('When the data source is Loki should test Prom and Ruler API endpoints to discover available features', async () => {
      mocks.fetchTestRulerRulesGroup.mockResolvedValue(null);
      mocks.fetchRules.mockResolvedValue([]);

      const response = await discoverDataSourceFeatures({ url: '/datasource/proxy', name: 'Loki', type: 'loki' });

      expect(response.application).toBe(PromApplication.Lotex);
      expect(response.features.rulerApiEnabled).toBe(true);

      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledTimes(1);
      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledWith('Loki');

      expect(mocks.fetchRules).toHaveBeenCalledTimes(1);
      expect(mocks.fetchRules).toHaveBeenCalledWith('Loki');
    });
    it('Should return Thanos with enabled ruler API', async () => {
      fetch
        .mockReturnValueOnce(
          of({
            data: {
              status: 'success',
              data: {
                version: '0.28.0',
              },
            },
          })
          // For the second call (to thanos flags api) return flags as this is a mock thanos datasource
        )
        .mockReturnValueOnce(
          of({
            data: {
              'grpc-address': 'true',
            },
          } as ThanosFlagsResponse)
        )
        // Third call to rules API should fail
        .mockRejectedValueOnce(new Error('404'));

      const response = await discoverDataSourceFeatures({
        url: '/datasource/proxy',
        name: 'Prometheus',
        type: 'prometheus',
      });

      expect(response.application).toBe(PromApplication.Thanos);
      expect(response.features.rulerApiEnabled).toBe(true);
      expect(mocks.fetchRules).not.toHaveBeenCalled();
      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalled();
    });

    // Something in this test is breaking subsequent tests, so its got to run last...
    it('Should return Thanos with disabled ruler API', async () => {
      fetch = jest.fn();

      mocks.fetchTestRulerRulesGroup.mockRejectedValueOnce({
        data: {
          message: RULER_NOT_SUPPORTED_MSG,
        },
      } as RulesQueryErrorResponse);
      mocks.fetchRules.mockRejectedValueOnce(undefined);

      fetch
        .mockReturnValueOnce(
          of({
            data: {
              status: 'success',
              data: {
                version: '0.18.0',
              },
            },
          })
          // For the second call (to thanos flags api) return flags as this is a mock thanos datasource
        )
        .mockReturnValueOnce(
          of({
            data: {
              'grpc-address': 'true',
            },
          } as ThanosFlagsResponse)
        );

      const response = await discoverDataSourceFeatures({
        url: '/datasource/proxy',
        name: 'Prometheus',
        type: 'prometheus',
      });

      expect(response.application).toBe(PromApplication.Thanos);
      expect(response.features.rulerApiEnabled).toBe(false);
      expect(mocks.fetchRules).not.toHaveBeenCalled();
      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalled();
    });
  });
});
