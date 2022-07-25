import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';

import { FormAmRoute } from '../../types/amroutes';
import { MatcherFieldValue } from '../../types/silence-form';

import { deleteRoute, getFilteredRoutes, updatedRoute } from './AmRoutesTable';

const defaultAmRoute: FormAmRoute = {
  id: '',
  object_matchers: [],
  continue: false,
  receiver: '',
  overrideGrouping: false,
  groupBy: [],
  overrideTimings: false,
  groupWaitValue: '',
  groupWaitValueType: '',
  groupIntervalValue: '',
  groupIntervalValueType: '',
  repeatIntervalValue: '',
  repeatIntervalValueType: '',
  muteTimeIntervals: [],
  routes: [],
};

const buildAmRoute = (override: Partial<FormAmRoute> = {}): FormAmRoute => {
  return { ...defaultAmRoute, ...override };
};

const buildMatcher = (name: string, value: string, operator: MatcherOperator): MatcherFieldValue => {
  return { name, value, operator };
};

describe('getFilteredRoutes', () => {
  it('Shoult return all entries when filters are empty', () => {
    // Arrange
    const routes: FormAmRoute[] = [buildAmRoute({ id: '1' }), buildAmRoute({ id: '2' }), buildAmRoute({ id: '3' })];

    // Act
    const filteredRoutes = getFilteredRoutes(routes, undefined, undefined);

    // Assert
    expect(filteredRoutes).toHaveLength(3);
    expect(filteredRoutes).toContain(routes[0]);
    expect(filteredRoutes).toContain(routes[1]);
    expect(filteredRoutes).toContain(routes[2]);
  });

  it('Should only return entries matching provided label query', () => {
    // Arrange
    const routes: FormAmRoute[] = [
      buildAmRoute({ id: '1' }),
      buildAmRoute({ id: '2', object_matchers: [buildMatcher('severity', 'critical', MatcherOperator.equal)] }),
      buildAmRoute({ id: '3' }),
    ];

    // Act
    const filteredRoutes = getFilteredRoutes(routes, 'severity=critical', undefined);

    // Assert
    expect(filteredRoutes).toHaveLength(1);
    expect(filteredRoutes).toContain(routes[1]);
  });

  it('Should only return entries matching provided contact query', () => {
    // Arrange
    const routes: FormAmRoute[] = [
      buildAmRoute({ id: '1' }),
      buildAmRoute({ id: '2', receiver: 'TestContactPoint' }),
      buildAmRoute({ id: '3' }),
    ];

    // Act
    const filteredRoutes = getFilteredRoutes(routes, undefined, 'contact');

    // Assert
    expect(filteredRoutes).toHaveLength(1);
    expect(filteredRoutes).toContain(routes[1]);
  });

  it('Should only return entries matching provided label and contact query', () => {
    // Arrange
    const routes: FormAmRoute[] = [
      buildAmRoute({ id: '1' }),
      buildAmRoute({
        id: '2',
        receiver: 'TestContactPoint',
        object_matchers: [buildMatcher('severity', 'critical', MatcherOperator.equal)],
      }),
      buildAmRoute({ id: '3' }),
    ];

    // Act
    const filteredRoutes = getFilteredRoutes(routes, 'severity=critical', 'contact');

    // Assert
    expect(filteredRoutes).toHaveLength(1);
    expect(filteredRoutes).toContain(routes[1]);
  });

  it('Should return entries matching regex matcher configuration without regex evaluation', () => {
    // Arrange
    const routes: FormAmRoute[] = [
      buildAmRoute({ id: '1' }),
      buildAmRoute({ id: '2', object_matchers: [buildMatcher('severity', 'critical', MatcherOperator.equal)] }),
      buildAmRoute({ id: '3', object_matchers: [buildMatcher('severity', 'crit', MatcherOperator.regex)] }),
    ];

    // Act
    const filteredRoutes = getFilteredRoutes(routes, 'severity=~crit', undefined);

    // Assert
    expect(filteredRoutes).toHaveLength(1);
    expect(filteredRoutes).toContain(routes[2]);
  });
});

describe('updatedRoute', () => {
  it('Should update an item of the same id', () => {
    // Arrange
    const routes: FormAmRoute[] = [buildAmRoute({ id: '1' }), buildAmRoute({ id: '2' }), buildAmRoute({ id: '3' })];

    const routeUpdate: FormAmRoute = {
      ...routes[1],
      object_matchers: [buildMatcher('severity', 'critical', MatcherOperator.equal)],
    };

    // Act
    const updatedRoutes = updatedRoute(routes, routeUpdate);

    // Assert
    expect(updatedRoutes).toHaveLength(3);
    const changedRoute = updatedRoutes[1];

    expect(changedRoute.object_matchers).toHaveLength(1);
    expect(changedRoute.object_matchers[0].name).toBe('severity');
    expect(changedRoute.object_matchers[0].value).toBe('critical');
    expect(changedRoute.object_matchers[0].operator).toBe(MatcherOperator.equal);
  });

  it('Should not update any element when an element of matching id not found', () => {
    // Arrange
    const routes: FormAmRoute[] = [buildAmRoute({ id: '1' }), buildAmRoute({ id: '2' }), buildAmRoute({ id: '3' })];

    const routeUpdate: FormAmRoute = {
      ...routes[1],
      id: '-1',
      object_matchers: [buildMatcher('severity', 'critical', MatcherOperator.equal)],
    };

    // Act
    const updatedRoutes = updatedRoute(routes, routeUpdate);

    // Assert
    expect(updatedRoutes).toHaveLength(3);

    updatedRoutes.forEach((route) => {
      expect(route.object_matchers).toHaveLength(0);
    });
  });
});

describe('deleteRoute', () => {
  it('Should delete an element of the same id', () => {
    // Arrange
    const routes: FormAmRoute[] = [buildAmRoute({ id: '1' }), buildAmRoute({ id: '2' }), buildAmRoute({ id: '3' })];

    const routeToDelete = routes[1];

    // Act
    const updatedRoutes = deleteRoute(routes, routeToDelete.id);

    // Assert
    expect(updatedRoutes).toHaveLength(2);
    expect(updatedRoutes[0].id).toBe('1');
    expect(updatedRoutes[1].id).toBe('3');
  });

  it('Should not delete anything when an element of matching id not found', () => {
    // Arrange
    const routes: FormAmRoute[] = [buildAmRoute({ id: '1' }), buildAmRoute({ id: '2' }), buildAmRoute({ id: '3' })];

    // Act
    const updatedRoutes = deleteRoute(routes, '-1');

    // Assert
    expect(updatedRoutes).toHaveLength(3);
    expect(updatedRoutes[0].id).toBe('1');
    expect(updatedRoutes[1].id).toBe('2');
    expect(updatedRoutes[2].id).toBe('3');
  });
});
