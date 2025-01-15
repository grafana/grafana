import { produce } from 'immer';

import { AlertManagerCortexConfig, MatcherOperator, Route } from 'app/plugins/datasource/alertmanager/types';

import { FormAmRoute } from '../../types/amroutes';
import { addUniqueIdentifierToRoute } from '../../utils/amroutes';

import { addRouteAction, deleteRouteAction, routesReducer, updateRouteAction } from './notificationPolicyRoutes';

describe('routes', () => {
  const defaultRoute: Route = {
    receiver: 'ROOT',
    group_by: ['grafana_folder'],
    object_matchers: [],

    routes: [
      {
        receiver: 'A',

        object_matchers: [['team', MatcherOperator.equal, 'operations']],
        routes: [
          {
            receiver: 'B1',
            object_matchers: [['region', MatcherOperator.equal, 'europe']],
          },
          {
            receiver: 'B2',
            object_matchers: [['region', MatcherOperator.equal, 'nasa']],
          },
        ],
      },
      {
        receiver: 'C',
        object_matchers: [['foo', MatcherOperator.equal, 'bar']],
      },
    ],
    group_wait: '10s',
    group_interval: '1m',
  };
  const rootRouteWithIdentifiers = addUniqueIdentifierToRoute(defaultRoute);
  const ROOT_identifier = rootRouteWithIdentifiers.id;
  const A_identifier = rootRouteWithIdentifiers.routes![0].id;

  const initialConfig: AlertManagerCortexConfig = {
    alertmanager_config: {
      time_intervals: [],
      mute_time_intervals: [],
      route: defaultRoute,
    },
    template_files: {},
  };
  it('Should add a new route with receiver E as a child of default route', () => {
    const routeWithID = addUniqueIdentifierToRoute({
      receiver: 'E',
    });
    const newFormRoute: Partial<FormAmRoute> = {
      receiver: 'E',
      id: routeWithID.id,
    };
    const action = addRouteAction({
      alertmanager: 'alertmanager',
      partialRoute: newFormRoute,
      referenceRouteIdentifier: ROOT_identifier,
      insertPosition: 'child',
    });

    const result = routesReducer(initialConfig, action);

    expect(result.alertmanager_config.route?.routes).toHaveLength(
      (initialConfig.alertmanager_config.route?.routes?.length ?? 0) + 1
    );

    // the last route if the root route should have receiver E
    expect(result.alertmanager_config.route?.routes?.at(-1)).toMatchObject({
      receiver: 'E',
    });

    // assert the rest of the configuration
    expect(result).toMatchSnapshot();
  });

  it('Should not add a new route with receiver E as a child of route with receiver A, if data has been updated by another user', () => {
    const routeWithID = addUniqueIdentifierToRoute({
      receiver: 'E',
    });
    const newFormRoute: Partial<FormAmRoute> = {
      receiver: 'E',
      id: routeWithID.id,
    };
    const action = addRouteAction({
      alertmanager: 'alertmanager',
      partialRoute: newFormRoute,
      referenceRouteIdentifier: A_identifier,
      insertPosition: 'child',
    });
    const modifiedConfig = produce(initialConfig, (draft) => {
      draft.alertmanager_config.route!.routes = [];
    });
    const rootRouteWithIdentifiers = addUniqueIdentifierToRoute(modifiedConfig.alertmanager_config.route!);
    const modifiedConfigWithIdentifiers = produce(modifiedConfig, (draft) => {
      draft.alertmanager_config.route = rootRouteWithIdentifiers;
    });
    expect(() => routesReducer(modifiedConfigWithIdentifiers, action)).toThrow();
  });

  it('Should update an existing route A with receiver B', () => {
    const newRoute: Partial<FormAmRoute> = {
      receiver: 'B',
      id: A_identifier,
    };
    const action = updateRouteAction({
      alertmanager: 'alertmanager',
      update: newRoute,
    });

    expect(routesReducer(initialConfig, action)).toMatchSnapshot();
  });

  it('Should not update route if config has been updated by another user', () => {
    const newRoute: Partial<FormAmRoute> = {
      receiver: 'B',
      id: A_identifier,
    };
    const action = updateRouteAction({
      alertmanager: 'alertmanager',
      update: newRoute,
    });
    const modifiedConfig = produce(initialConfig, (draft) => {
      draft.alertmanager_config.route!.routes = [];
    });
    const rootRouteWithIdentifiers = addUniqueIdentifierToRoute(modifiedConfig.alertmanager_config.route!);
    const modifiedConfigWithIdentifiers = produce(modifiedConfig, (draft) => {
      draft.alertmanager_config.route = rootRouteWithIdentifiers;
    });
    expect(() => routesReducer(modifiedConfigWithIdentifiers, action)).toThrow();
  });

  it('Should delete route', () => {
    const action = deleteRouteAction({
      id: A_identifier,
    });
    expect(routesReducer(initialConfig, action)).toMatchSnapshot();
  });
});
