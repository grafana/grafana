import * as rolesService from '../Roles.service';

export const RolesService = jest.genMockFromModule<typeof rolesService>('../Roles.service').default;

RolesService.setDefault = () => Promise.resolve();
