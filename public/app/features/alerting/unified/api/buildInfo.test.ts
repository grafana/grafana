import { of, throwError } from 'rxjs';

import { PromApplication } from 'app/types/unified-alerting-dto';

import { discoverDataSourceFeatures } from './buildInfo';
import { fetchRules } from './prometheus';
import { fetchTestRulerRulesGroup } from './ruler';

const fetch = jest.fn();

jest.mock('./prometheus');
jest.mock('./ruler');
jest.mock('app/core/services/context_srv', () => ({
  contextSrv: jest.fn(),
}));
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ fetch }),
}));

const mocks = {
  fetchRules: jest.mocked(fetchRules),
  fetchTestRulerRulesGroup: jest.mocked(fetchTestRulerRulesGroup),
};

beforeEach(() => jest.resetAllMocks());

describe('discoverDataSourceFeatures', () => {
  describe('When buildinfo returns 200 response', () => {
    it('Should return Prometheus with disabled ruler API when application and features fields are missing', async () => {
      fetch.mockReturnValue(
        of({
          data: {
            status: 'success',
            data: {
              version: '2.32.1',
            },
          },
        })
      );

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

    it('Should return Mimir with disabled ruler API when buildinfo reports ruler_config_api false', async () => {
      fetch.mockReturnValue(
        of({
          data: {
            status: 'success',
            data: {
              version: '2.32.1',
              features: {
                ruler_config_api: 'false',
              },
            },
          },
        })
      );

      const response = await discoverDataSourceFeatures({
        url: '/datasource/proxy',
        name: 'Mimir',
        type: 'prometheus',
      });

      expect(response.application).toBe(PromApplication.Mimir);
      expect(response.features.rulerApiEnabled).toBe(false);
      expect(mocks.fetchRules).not.toHaveBeenCalled();
      expect(mocks.fetchTestRulerRulesGroup).not.toHaveBeenCalled();
    });

    it('Should return Mimir with enabled ruler API when buildinfo and config API probe both succeed', async () => {
      fetch.mockReturnValue(
        of({
          data: {
            status: 'success',
            data: {
              version: '2.32.1',
              features: {
                ruler_config_api: 'true',
              },
            },
          },
        })
      );
      mocks.fetchTestRulerRulesGroup.mockResolvedValue(null);

      const response = await discoverDataSourceFeatures({
        url: '/datasource/proxy',
        name: 'Mimir',
        type: 'prometheus',
      });

      expect(response.application).toBe(PromApplication.Mimir);
      expect(response.features.rulerApiEnabled).toBe(true);
      expect(mocks.fetchRules).not.toHaveBeenCalled();
      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledTimes(1);
      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledWith('Mimir', 'mimir');
    });

    it('Should return Mimir with disabled ruler API when config API probe returns a bad request', async () => {
      fetch.mockReturnValue(
        of({
          data: {
            status: 'success',
            data: {
              version: '2.32.1',
              features: {
                ruler_config_api: 'true',
              },
            },
          },
        })
      );
      mocks.fetchTestRulerRulesGroup.mockRejectedValue({
        status: 400,
        data: {
          message: 'bad request',
        },
      });

      const response = await discoverDataSourceFeatures({
        url: '/datasource/proxy',
        name: 'Mimir',
        type: 'prometheus',
      });

      expect(response.application).toBe(PromApplication.Mimir);
      expect(response.features.rulerApiEnabled).toBe(false);
      expect(mocks.fetchRules).not.toHaveBeenCalled();
      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledTimes(1);
      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledWith('Mimir', 'mimir');
    });

    it('When the data source is Loki should not call the buildinfo endpoint', async () => {
      await discoverDataSourceFeatures({ url: '/datasource/proxy', name: 'Loki', type: 'loki' });

      expect(fetch).not.toBeCalled();
    });

    it('When the data source is Loki should test Prom and Ruler API endpoints to discover available features', async () => {
      mocks.fetchTestRulerRulesGroup.mockResolvedValue(null);
      mocks.fetchRules.mockResolvedValue([]);

      const response = await discoverDataSourceFeatures({ url: '/datasource/proxy', name: 'Loki', type: 'loki' });

      expect(response.application).toBe('Loki');
      expect(response.features.rulerApiEnabled).toBe(true);

      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledTimes(1);
      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledWith('Loki', undefined);

      expect(mocks.fetchRules).toHaveBeenCalledTimes(1);
      expect(mocks.fetchRules).toHaveBeenCalledWith('Loki');
    });
  });

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

      expect(response.application).toBe(PromApplication.Cortex);
      expect(response.features.rulerApiEnabled).toBe(false);

      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledTimes(1);
      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledWith('Cortex', undefined);

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

      expect(response.application).toBe(PromApplication.Cortex);
      expect(response.features.rulerApiEnabled).toBe(true);

      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledTimes(1);
      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledWith('Cortex', undefined);

      expect(mocks.fetchRules).toHaveBeenCalledTimes(1);
      expect(mocks.fetchRules).toHaveBeenCalledWith('Cortex');
    });

    it('Should throw when Cortex ruler probe returns an unexpected bad request', async () => {
      fetch.mockReturnValue(
        throwError(() => ({
          status: 404,
        }))
      );

      const error = {
        status: 400,
        data: {
          message: 'bad request',
        },
      };
      mocks.fetchTestRulerRulesGroup.mockRejectedValue(error);
      mocks.fetchRules.mockResolvedValue([]);

      await expect(
        discoverDataSourceFeatures({
          url: '/datasource/proxy',
          name: 'Cortex',
          type: 'prometheus',
        })
      ).rejects.toBe(error);

      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledTimes(1);
      expect(mocks.fetchTestRulerRulesGroup).toHaveBeenCalledWith('Cortex', undefined);

      expect(mocks.fetchRules).toHaveBeenCalledTimes(1);
      expect(mocks.fetchRules).toHaveBeenCalledWith('Cortex');
    });
  });
});
