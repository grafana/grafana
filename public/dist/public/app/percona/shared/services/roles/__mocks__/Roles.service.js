export const RolesService = jest.genMockFromModule('../Roles.service').default;
RolesService.list = () => Promise.resolve([]);
RolesService.setDefault = () => Promise.resolve();
RolesService.delete = () => Promise.resolve();
export default RolesService;
//# sourceMappingURL=Roles.service.js.map