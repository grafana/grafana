import { getBackendSrv } from '@grafana/runtime';

import { getSavedDashboard } from './lifecycleApi';

const get = jest.fn(async () => ({}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

describe('getSavedDashboard', () => {
  beforeEach(() => {
    get.mockClear();
    jest.mocked(getBackendSrv).mockReturnValue({ get } as unknown as ReturnType<typeof getBackendSrv>);
  });

  it.each(['..', 'a/b', '../other', 'a%2Fb', 'a b'])('refuses %j, which would change the request path', async (uid) => {
    await expect(getSavedDashboard(uid)).rejects.toThrow('Invalid dashboard uid');
    expect(get).not.toHaveBeenCalled();
  });

  it('reads a dashboard by its uid', async () => {
    await getSavedDashboard('abc-1_x.y');

    expect(get).toHaveBeenCalledWith(expect.stringMatching(/\/dashboards\/abc-1_x\.y$/), undefined, undefined, {
      showErrorAlert: false,
    });
  });
});
