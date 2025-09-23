import * as rolesService from '../Roles.service';

export const RolesService = jest.genMockFromModule<typeof rolesService>('../Roles.service').default;

RolesService.list = () => Promise.resolve([]);

RolesService.setDefault = () => Promise.resolve();

RolesService.delete = () => Promise.resolve();

export default RolesService;
