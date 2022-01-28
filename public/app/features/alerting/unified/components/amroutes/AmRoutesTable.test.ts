import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import { FormAmRoute } from '../../types/amroutes';
import { MatcherFieldValue } from '../../types/silence-form';
import { getFilteredRoutes } from './AmRoutesTable';

const defaultAmRoute: FormAmRoute = {
  id: '',
  object_matchers: [],
  continue: false,
  receiver: '',
  groupBy: [],
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
