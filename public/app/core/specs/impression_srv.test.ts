const mockBackendSrv = jest.fn();

import impressionSrv from '../services/impression_srv';

jest.mock('@grafana/runtime', () => {
  const originalRuntime = jest.requireActual('@grafana/runtime');
  return {
    ...originalRuntime,
    getBackendSrv: mockBackendSrv,
  };
});

jest.mock('app/core/services/context_srv', () => {
  const original = jest.requireActual('app/core/services/context_srv');
  const mockedContext = { ...original };

  mockedContext.contextSrv.user.orgId = 'testOrgId';

  return mockedContext;
});

describe('ImpressionSrv', () => {
  beforeEach(() => {
    window.localStorage.removeItem(impressionSrv.impressionKey());
  });

  describe('getDashboardOpened', () => {
    it('should return list of dashboard uids', async () => {
      window.localStorage.setItem(impressionSrv.impressionKey(), JSON.stringify(['five', 'four', 1, 2, 3]));
      mockBackendSrv.mockImplementation(() => ({ get: jest.fn().mockResolvedValue(['one', 'two', 'three']) }));
      const result1 = await impressionSrv.getDashboardOpened();
      expect(result1).toEqual(['five', 'four', 'one', 'two', 'three']);

      window.localStorage.setItem(impressionSrv.impressionKey(), JSON.stringify(['three', 'four']));
      const result2 = await impressionSrv.getDashboardOpened();
      expect(result2).toEqual(['three', 'four']);

      window.localStorage.setItem(impressionSrv.impressionKey(), JSON.stringify([1, 2, 3]));
      mockBackendSrv.mockImplementation(() => ({ get: jest.fn().mockResolvedValue(['one', 'two', 'three']) }));
      const result3 = await impressionSrv.getDashboardOpened();
      expect(result3).toEqual(['one', 'two', 'three']);
    });
  });
});
