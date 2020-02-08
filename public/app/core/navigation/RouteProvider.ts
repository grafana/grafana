import { match } from 'react-router-dom';
import { Location } from 'history';
import parseKeyValue from './utils/parseKeyValue';

// MVP: Replacement for $route

export class RouteProvider {
  // To be Angular $route API compliant...
  current = {
    params: {},
    locals: {},
    $$route: {},
  };

  $$route = {};

  $get() {
    return this;
  }

  updateRoute(match: match<any>, location: Location<any>) {
    const { params } = match;
    const { search } = location;
    const queryParams = parseKeyValue(search.slice(1));

    this.current = {
      params: {
        ...queryParams, // accoring to Angular docs: path params take precedence over search params
        ...params,
      },
      locals: {},
    };
  }

  updateRouteLocals(locals: {}) {
    this.current = {
      ...this.current,
      locals: { ...locals },
    };
  }

  updateCurrentRoute(current: {}) {
    this.current = {
      ...this.current,
      ...current,
    };
  }
}
