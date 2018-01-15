import { types } from 'mobx-state-tree';

export const ResultItem = types.model('ResultItem', {
  id: types.identifier(types.number),
  folderId: types.optional(types.number, 0),
  title: types.string,
  url: types.string,
  icon: types.string,
  folderTitle: types.optional(types.string, ''),
});
