import { types } from 'mobx-state-tree';

const QueryValueType = types.union(types.string, types.boolean, types.number);
const urlParameterize = queryObj => {
  const keys = Object.keys(queryObj);
  const newQuery = keys.reduce((acc: string, key: string, idx: number) => {
    const preChar = idx === 0 ? '?' : '&';
    return acc + preChar + key + '=' + queryObj[key];
  }, '');

  return newQuery;
};

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
        path += urlParameterize(self.query.toJS());
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
