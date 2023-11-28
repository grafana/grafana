export const { UserService } = jest.genMockFromModule('../User.service');
UserService.getUsersList = () => Promise.resolve({
    users: [],
});
//# sourceMappingURL=User.service.js.map