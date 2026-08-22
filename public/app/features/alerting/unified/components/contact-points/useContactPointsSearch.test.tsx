import { renderHook } from 'test/test-utils';

import { RECEIVER_META_KEY } from './constants';
import { useContactPointsSearch } from './useContactPointsSearch';
import { type ContactPointWithMetadata } from './utils';

const makeContactPoint = (name: string, receiverTypeName: string): ContactPointWithMetadata => ({
  id: name,
  name,
  grafana_managed_receiver_configs: [
    {
      name: receiverTypeName,
      type: 'email',
      disableResolveMessage: false,
      settings: {},
      [RECEIVER_META_KEY]: {
        name: receiverTypeName,
      },
    },
  ],
});

describe('useContactPointsSearch', () => {
  const contactPoints: ContactPointWithMetadata[] = [
    makeContactPoint('team-primary-email', 'Email'),
    makeContactPoint('pagerduty-critical', 'PagerDuty'),
    makeContactPoint('RBAC_Team_Alert_Writer-UPDATED-admin-contact-point-1784911123489', 'Webhook'),
  ];

  it('returns all contact points when search is empty', () => {
    const { result } = renderHook(() => useContactPointsSearch(contactPoints, ''));

    expect(result.current).toHaveLength(3);
  });

  it('uses fuzzy matching for short queries', () => {
    const { result } = renderHook(() => useContactPointsSearch(contactPoints, 'pagerduty'));

    expect(result.current).toEqual([contactPoints[1]]);
  });

  it('uses contains matching for long queries and still finds exact-ish contact point names', () => {
    const longSearch = 'RBAC_Team_Alert_Writer-UPDATED-admin-contact-point-1784911123489';

    const { result } = renderHook(() => useContactPointsSearch(contactPoints, longSearch));

    expect(result.current).toEqual([contactPoints[2]]);
  });

  it('uses contains matching for long queries against receiver type names', () => {
    const longSearch = 'pagerduty-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    const cpWithLongType = makeContactPoint('alerts-oncall', longSearch);

    const { result } = renderHook(() => useContactPointsSearch([...contactPoints, cpWithLongType], longSearch));

    expect(result.current).toEqual([cpWithLongType]);
  });
});
