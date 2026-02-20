import { RoutingTreeRoute } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { MatcherOperator, ROUTES_META_SYMBOL, Route } from 'app/plugins/datasource/alertmanager/types';

import { KnownProvenance } from '../../types/knownProvenance';
import { ROOT_ROUTE_NAME } from '../../utils/k8s/constants';

import {
  createKubernetesRoutingTreeSpec,
  isRouteProvisioned,
  k8sSubRouteToRoute,
  routeToK8sSubRoute,
} from './useNotificationPolicyRoute';

test('k8sSubRouteToRoute', () => {
  const input: RoutingTreeRoute = {
    continue: false,
    group_by: ['label1'],
    group_interval: '5m',
    group_wait: '30s',
    matchers: [{ label: 'label1', type: '=', value: 'value1' }],
    mute_time_intervals: ['mt-1'],
    receiver: 'my-receiver',
    repeat_interval: '4h',
    routes: [
      {
        continue: false,
        receiver: 'receiver2',
        matchers: [{ label: 'label2', type: '!=', value: 'value2' }],
      },
    ],
  };

  const expected: Route = {
    name: 'test-name',
    continue: false,
    group_by: ['label1'],
    group_interval: '5m',
    group_wait: '30s',
    matchers: undefined, // matchers -> object_matchers
    object_matchers: [['label1', MatcherOperator.equal, 'value1']],
    mute_time_intervals: ['mt-1'],
    receiver: 'my-receiver',
    repeat_interval: '4h',
    routes: [
      {
        continue: false,
        name: 'test-name',
        receiver: 'receiver2',
        matchers: undefined,
        object_matchers: [['label2', MatcherOperator.notEqual, 'value2']],
        routes: undefined,
      },
    ],
  };

  expect(k8sSubRouteToRoute(input, 'test-name')).toStrictEqual(expected);
});

test('routeToK8sSubRoute', () => {
  const input: Route = {
    continue: false,
    group_by: ['label1'],
    group_interval: '5m',
    group_wait: '30s',
    matchers: undefined, // matchers -> object_matchers
    object_matchers: [['label1', MatcherOperator.equal, 'value1']],
    mute_time_intervals: ['mt-1'],
    receiver: 'my-receiver',
    repeat_interval: '4h',
    routes: [
      {
        receiver: 'receiver2',
        matchers: undefined,
        object_matchers: [['label2', MatcherOperator.notEqual, 'value2']],
      },
    ],
  };

  const expected: RoutingTreeRoute = {
    continue: false,
    group_by: ['label1'],
    group_interval: '5m',
    group_wait: '30s',
    matchers: [{ label: 'label1', type: '=', value: 'value1' }],
    mute_time_intervals: ['mt-1'],
    receiver: 'my-receiver',
    repeat_interval: '4h',
    routes: [
      {
        continue: false,
        receiver: 'receiver2',
        matchers: [{ label: 'label2', type: '!=', value: 'value2' }],
        routes: undefined,
      },
    ],
  };

  expect(routeToK8sSubRoute(input)).toStrictEqual(expected);
});

test('createKubernetesRoutingTreeSpec', () => {
  const route: Route = {
    continue: true,
    group_by: ['alertname'],
    matchers: undefined,
    object_matchers: [['severity', MatcherOperator.equal, 'critical']],
    mute_time_intervals: ['interval-1'],
    receiver: 'default-receiver',
    repeat_interval: '4h',
    routes: [
      {
        continue: false,
        receiver: 'nested-receiver',
        object_matchers: [['team', MatcherOperator.equal, 'frontend']],
        group_wait: '30s',
        group_interval: '5m',
      },
    ],
    [ROUTES_META_SYMBOL]: {
      resourceVersion: 'abc123',
    },
  };

  const tree = createKubernetesRoutingTreeSpec(route);

  expect(tree.metadata.name).toBe(ROOT_ROUTE_NAME);
  expect(tree).toMatchSnapshot();
});

describe('isRouteProvisioned', () => {
  it('returns false when route has no provenance', () => {
    const route: Route = {
      receiver: 'test-receiver',
    };

    expect(isRouteProvisioned(route)).toBeFalsy();
  });

  it('returns false when route has KnownProvenance.None in metadata', () => {
    const route: Route = {
      receiver: 'test-receiver',
      [ROUTES_META_SYMBOL]: {
        provenance: KnownProvenance.None,
      },
    };

    expect(isRouteProvisioned(route)).toBeFalsy();
  });

  it('returns false when route has KnownProvenance.None at top level', () => {
    const route: Route = {
      receiver: 'test-receiver',
      provenance: KnownProvenance.None,
    };
    expect(isRouteProvisioned(route)).toBeFalsy();
  });

  it('returns true when route has file provenance in metadata', () => {
    const route: Route = {
      receiver: 'test-receiver',
      [ROUTES_META_SYMBOL]: {
        provenance: KnownProvenance.File,
      },
    };

    expect(isRouteProvisioned(route)).toBeTruthy();
  });

  it('returns true when route has api provenance in metadata', () => {
    const route: Route = {
      receiver: 'test-receiver',
      [ROUTES_META_SYMBOL]: {
        provenance: KnownProvenance.API,
      },
    };

    expect(isRouteProvisioned(route)).toBeTruthy();
  });

  it('returns true when route has converted_prometheus provenance in metadata', () => {
    const route: Route = {
      receiver: 'test-receiver',
      [ROUTES_META_SYMBOL]: {
        provenance: KnownProvenance.ConvertedPrometheus,
      },
    };

    expect(isRouteProvisioned(route)).toBeTruthy();
  });

  it('returns true when route has file provenance at top level', () => {
    const route: Route = {
      receiver: 'test-receiver',
      provenance: KnownProvenance.File,
    };

    expect(isRouteProvisioned(route)).toBeTruthy();
  });

  it('falls back to top-level provenance when metadata provenance is missing', () => {
    const route: Route = {
      receiver: 'test-receiver',
      provenance: KnownProvenance.File,
      [ROUTES_META_SYMBOL]: {
        provenance: undefined,
      },
    };

    expect(isRouteProvisioned(route)).toBeTruthy();
  });
});
