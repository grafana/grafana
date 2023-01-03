import { Role } from 'app/types';

export const isNotDelegatable = (role: Role) => {
  return role.delegatable !== undefined && !role.delegatable;
};
