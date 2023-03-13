import { dateTime } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import { isNewUser, USER_CREATION_MIN_DAYS } from './Analytics';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn().mockReturnValue({
    get: jest.fn(),
  }),
}));

describe('isNewUser', function () {
  it('should return true if the user has been created within the last two weeks', async () => {
    const newUser = {
      id: 1,
      createdAt: dateTime().subtract(14, 'days'),
    };

    getBackendSrv().get = jest.fn().mockResolvedValue(newUser);

    const isNew = await isNewUser();
    expect(isNew).toBe(true);
    expect(getBackendSrv().get).toHaveBeenCalledTimes(1);
    expect(getBackendSrv().get).toHaveBeenCalledWith('/api/user');
  });

  it('should return false if the user has been created prior to the last two weeks', async () => {
    const oldUser = {
      id: 2,
      createdAt: dateTime().subtract(USER_CREATION_MIN_DAYS, 'days'),
    };

    getBackendSrv().get = jest.fn().mockResolvedValue(oldUser);

    const isNew = await isNewUser();
    expect(isNew).toBe(false);
    expect(getBackendSrv().get).toHaveBeenCalledTimes(1);
    expect(getBackendSrv().get).toHaveBeenCalledWith('/api/user');
  });
});
