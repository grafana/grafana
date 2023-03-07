import * as userService from '../User.service';

export const { UserService } = jest.genMockFromModule<typeof userService>('../User.service');

UserService.getUsersList = () =>
  Promise.resolve({
    users: [],
  });
