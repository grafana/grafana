import { types } from 'mobx-state-tree';
import { ResultItem } from './ResultItem';

export const SearchResultSection = types
  .model('SearchResultSection', {
    id: types.identifier(),
    title: types.string,
    icon: types.string,
    expanded: types.boolean,
    items: types.array(ResultItem),
  })
  .actions(self => ({
    toggle() {
      self.expanded = !self.expanded;

      for (let i = 0; i < 100; i++) {
        self.items.push(
          ResultItem.create({
            id: i,
            title: 'Dashboard ' + self.items.length,
            icon: 'gicon gicon-dashboard',
            url: 'asd',
          })
        );
      }
    },
  }));
