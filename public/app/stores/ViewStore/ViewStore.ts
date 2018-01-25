import { types } from 'mobx-state-tree';
import { toJS } from 'mobx';
import { toUrlParams } from 'app/core/utils/url';

const QueryInnerValueType = types.union(types.string, types.boolean, types.number);
const QueryValueType = types.union(QueryInnerValueType, types.array(QueryInnerValueType));

export const ViewStore = types
  .model({
    path: types.string,
    query: types.map(QueryValueType),
    routeParams: types.map(QueryValueType),
  })
  .views(self => ({
    get currentUrl() {
      let path = self.path;

      if (self.query.size) {
        path += '?' + toUrlParams(toJS(self.query));
      }
      return path;
    },
  }))
  .actions(self => {
    function updateQuery(query: any) {
      self.query.clear();
      for (let key of Object.keys(query)) {
        self.query.set(key, query[key]);
      }
    }

    function updateRouteParams(routeParams: any) {
      self.routeParams.clear();
      for (let key of Object.keys(routeParams)) {
        self.routeParams.set(key, routeParams[key]);
      }
    }

    function updatePathAndQuery(path: string, query: any, routeParams: any) {
      self.path = path;
      updateQuery(query);
      updateRouteParams(routeParams);
    }

    return {
      updateQuery,
      updatePathAndQuery,
    };
  });
