import { PromApplication } from 'app/types/unified-alerting-dto';
import { of, throwError } from 'rxjs';
import { fetchDataSourceBuildInfo } from './buildInfo';
import { fetchRules } from './prometheus';
import { fetchRulerRulesGroup } from './ruler';

const fetch = jest.fn();

jest.mock('./prometheus');
jest.mock('./ruler');
jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({ fetch }),
}));

const mocks = {
  fetchRules: jest.mocked(fetchRules),
  fetchRulerRulesGroup: jest.mocked(fetchRulerRulesGroup),
};

beforeEach(() => jest.clearAllMocks());

describe('buildInfo', () => {
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

      const response = await fetchDataSourceBuildInfo({ url: '/datasource/proxy', name: 'Prometheus' });

      expect(response.application).toBe(PromApplication.Prometheus);
      expect(response.features.rulerApiEnabled).toBe(false);
      expect(mocks.fetchRules).not.toHaveBeenCalled();
      expect(mocks.fetchRulerRulesGroup).not.toHaveBeenCalled();
    });

    it.each([true, false])(
      `Should return Prometheus with rulerApiEnabled set to %p according to the ruler_config_api value`,
      async (rulerApiEnabled) => {
        fetch.mockReturnValue(
          of({
            data: {
              status: 'success',
              data: {
                version: '2.32.1',
                features: {
                  // 'true' and 'false' as strings is intentional
                  // This is the format returned from the buildinfo endpoint
                  ruler_config_api: rulerApiEnabled ? 'true' : 'false',
                },
              },
            },
          })
        );

        const response = await fetchDataSourceBuildInfo({ url: '/datasource/proxy', name: 'Prometheus' });

        expect(response.application).toBe(PromApplication.Prometheus);
        expect(response.features.rulerApiEnabled).toBe(rulerApiEnabled);
        expect(mocks.fetchRules).not.toHaveBeenCalled();
        expect(mocks.fetchRulerRulesGroup).not.toHaveBeenCalled();
      }
    );
  });

  describe('When buildinfo returns 404 error', () => {
    it('Should return cortex with ruler API disabled when prom rules works and ruler api returns not avaiable errors', async () => {
      fetch.mockReturnValue(
        throwError(() => ({
          status: 404,
        }))
      );

      mocks.fetchRulerRulesGroup.mockRejectedValue({
        status: 404,
        data: {
          message: 'page not found',
        },
      });
      mocks.fetchRules.mockResolvedValue([]);

      const response = await fetchDataSourceBuildInfo({ url: '/datasource/proxy', name: 'Cortex' });

      expect(response.application).toBe(PromApplication.Cortex);
      expect(response.features.rulerApiEnabled).toBe(false);

      expect(mocks.fetchRulerRulesGroup).toHaveBeenCalledTimes(1);
      expect(mocks.fetchRulerRulesGroup).toHaveBeenCalledWith('Cortex', 'test', 'test');

      expect(mocks.fetchRules).toHaveBeenCalledTimes(1);
      expect(mocks.fetchRules).toHaveBeenCalledWith('Cortex');
    });

    it('Should return cortex with ruler API enabled when prom rules works and ruler api returns cortex error', async () => {
      console.log('hello');
      fetch.mockReturnValue(
        throwError(() => ({
          status: 404,
        }))
      );

      mocks.fetchRulerRulesGroup.mockResolvedValue(null);
      mocks.fetchRules.mockResolvedValue([]);

      const response = await fetchDataSourceBuildInfo({ url: '/datasource/proxy', name: 'Cortex' });

      expect(response.application).toBe(PromApplication.Cortex);
      expect(response.features.rulerApiEnabled).toBe(true);

      expect(mocks.fetchRulerRulesGroup).toHaveBeenCalledTimes(1);
      expect(mocks.fetchRulerRulesGroup).toHaveBeenCalledWith('Cortex', 'test', 'test');

      expect(mocks.fetchRules).toHaveBeenCalledTimes(1);
      expect(mocks.fetchRules).toHaveBeenCalledWith('Cortex');
    });
  });
});
