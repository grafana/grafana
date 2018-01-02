import { types } from 'mobx-state-tree';
import _ from 'lodash';
import $ from 'jquery';

let QueryValueType = types.union(types.string, types.boolean, types.number);

export const ViewStore = types
  .model({
    path: types.string,
    query: types.map(QueryValueType),
  })
  .views(self => ({
    get currentUrl() {
      let path = self.path;
      if (self.query.size) {
        path += '?' + $.param(self.query.toJS());
      }
      return path;
    },
  }))
  .actions(self => ({
    updatePathAndQuery(path: string, query: any) {
      self.path = path;
      self.query.clear();

      for (let key of _.keys(query)) {
        self.query.set(key, query[key]);
      }
    },

    updateQuery(query: any) {
      self.query.clear();
      for (let key of _.keys(query)) {
        self.query.set(key, query[key]);
      }
    },
  }));
