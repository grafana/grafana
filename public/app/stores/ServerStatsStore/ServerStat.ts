import { types } from 'mobx-state-tree';

export const ServerStat = types.model('ServerStat', {
  name: types.string,
  value: types.optional(types.number, 0),
});
