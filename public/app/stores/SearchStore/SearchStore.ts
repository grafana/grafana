import { types } from 'mobx-state-tree';
import { SearchResultSection } from './SearchResultSection';

export const SearchStore = types
  .model('SearchStore', {
    sections: types.array(SearchResultSection),
  })
  .actions(self => ({
    query() {
      for (let i = 0; i < 100; i++) {
        self.sections.push(
          SearchResultSection.create({
            id: 'starred' + i,
            title: 'starred',
            icon: 'fa fa-fw fa-star-o',
            expanded: false,
            items: [],
          })
        );
      }
    },
  }));
