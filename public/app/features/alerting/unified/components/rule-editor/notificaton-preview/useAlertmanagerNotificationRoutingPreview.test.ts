/**
 * Regression tests for PR #124697
 *
 * Bug: when policyName is explicitly set, the synthetic root object_matchers
 * (__grafana_managed_route__ = <name>) injected by k8sRouteToRoute blocked every
 * instance from entering the tree. Strip them so real matching can proceed.
 */
import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import { NAMED_ROOT_LABEL_NAME } from 'app/features/alerting/unified/components/notification-policies/useNotificationPolicyRoute';
import { ROOT_ROUTE_NAME } from 'app/features/alerting/unified/utils/k8s/constants';

import { setupMswServer } from '../../../mockApi';
import { routeGroupsMatcher } from '../../../routeGroupsMatcher';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';

import { useAlertmanagerNotificationRoutingPreview } from './useAlertmanagerNotificationRoutingPreview';

// Use the manual __mocks__ version that delegates to routeGroupsMatcher synchronously
jest.mock('../../../useRouteGroupsMatcher');

setupMswServer();

// A named policy that exists in the default MSW mock routing tree map
const EXISTING_NAMED_POLICY = 'Managed Policy - Empty Provisioned';

const wrapper = getWrapper({ renderWithRouter: false });

describe('useAlertmanagerNotificationRoutingPreview', () => {
  let matchSpy: jest.SpyInstance;

  beforeEach(() => {
    matchSpy = jest.spyOn(routeGroupsMatcher, 'matchInstancesToRoutes');
  });

  afterEach(() => {
    matchSpy.mockRestore();
  });

  // Regression test for bug from PR #124697:
  // When policyName is provided the synthetic root object_matchers must be cleared
  // so that instances are not rejected at the root before reaching sub-routes.
  it('clears root object_matchers when policyName is explicitly provided', async () => {
    const instances = [{ team: 'ops', severity: 'critical' }];

    renderHook(
      () => useAlertmanagerNotificationRoutingPreview(GRAFANA_RULES_SOURCE_NAME, instances, EXISTING_NAMED_POLICY),
      { wrapper }
    );

    await waitFor(() => {
      expect(matchSpy).toHaveBeenCalled();
    });

    const [rootRoute] = matchSpy.mock.calls[0];

    // The synthetic root matcher injected by k8sRouteToRoute must be absent so
    // instances can flow into sub-routes. Before the fix this array retained the
    // [[NAMED_ROOT_LABEL_NAME, '=', policyName]] matcher, blocking all instances.
    expect(rootRoute.object_matchers).toEqual([]);
  });

  // Regression test: when no policyName is given (default tree), the root matchers
  // must NOT be cleared — they are needed to differentiate trees in the legacy path.
  it('preserves root object_matchers when no policyName is provided', async () => {
    const instances = [{ team: 'ops' }];

    renderHook(() => useAlertmanagerNotificationRoutingPreview(GRAFANA_RULES_SOURCE_NAME, instances, undefined), {
      wrapper,
    });

    await waitFor(() => {
      expect(matchSpy).toHaveBeenCalled();
    });

    const [rootRoute] = matchSpy.mock.calls[0];

    // object_matchers should still be present (non-empty) so that legacy-mode
    // tree discrimination continues to work.
    expect(rootRoute.object_matchers).toBeDefined();
    expect(rootRoute.object_matchers?.length).toBeGreaterThan(0);
  });

  // Regression test for legacy mode from PR #124697:
  // When policyName is not set but instances carry __grafana_managed_route__,
  // the hook should derive routeName from the label and use that tree.
  it('derives routeName from instance label when policyName is absent (legacy mode)', async () => {
    // Instance carries the named-route label pointing to an existing policy
    const instances = [{ [NAMED_ROOT_LABEL_NAME]: EXISTING_NAMED_POLICY, severity: 'warning' }];

    renderHook(() => useAlertmanagerNotificationRoutingPreview(GRAFANA_RULES_SOURCE_NAME, instances, undefined), {
      wrapper,
    });

    await waitFor(() => {
      expect(matchSpy).toHaveBeenCalled();
    });

    // The hook should attempt matching (not bail out for missing policy)
    const [rootRoute] = matchSpy.mock.calls[0];
    // Since no explicit policyName was provided, object_matchers are NOT cleared —
    // the legacy root matcher is still there.
    expect(rootRoute.object_matchers).toBeDefined();
    expect(rootRoute.object_matchers?.length).toBeGreaterThan(0);
  });

  // Regression test: with policyName set to the default root, routing also works.
  it('handles the default root route when policyName is ROOT_ROUTE_NAME', async () => {
    const instances = [{ severity: 'critical' }];

    renderHook(() => useAlertmanagerNotificationRoutingPreview(GRAFANA_RULES_SOURCE_NAME, instances, ROOT_ROUTE_NAME), {
      wrapper,
    });

    await waitFor(() => {
      expect(matchSpy).toHaveBeenCalled();
    });

    const [rootRoute] = matchSpy.mock.calls[0];
    // policyName is set (ROOT_ROUTE_NAME) so object_matchers must also be cleared
    expect(rootRoute.object_matchers).toEqual([]);
  });
});
