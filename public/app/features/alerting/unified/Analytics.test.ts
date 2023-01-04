import { dateTime } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import { isNewUser } from './Analytics';

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
    const getRequestSpy = jest.spyOn(getBackendSrv(), 'get');

    const isNew = await isNewUser(1);
    expect(isNew).toBe(true);
    expect(getRequestSpy).toHaveBeenCalledTimes(1);
    expect(getRequestSpy).toHaveBeenCalledWith('/api/users/1');
  });

  it('should return false if the user has been created prior to the last two weeks', async () => {
    const oldUser = {
      id: 2,
      createdAt: dateTime().subtract(15, 'days'),
    };

    getBackendSrv().get = jest.fn().mockResolvedValue(oldUser);
    const getRequestSpy = jest.spyOn(getBackendSrv(), 'get');

    const isNew = await isNewUser(2);
    expect(isNew).toBe(false);
    expect(getRequestSpy).toHaveBeenCalledTimes(1);
    expect(getRequestSpy).toHaveBeenCalledWith('/api/users/2');
  });
});
