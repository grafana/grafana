import { RuleGroupIdentifier, RuleGroupIdentifierV2 } from 'app/types/unified-alerting';

import { ruleGroupIdentifierV2toV1 } from './groupIdentifier';

describe('ruleGroupIdentifierV2toV1', () => {
  it('should convert grafana v2 rule group identifier to v1 format', () => {
    const identifier: RuleGroupIdentifierV2 = {
      groupName: 'group-1',
      namespace: {
        uid: 'uid123',
      },
      groupOrigin: 'grafana',
    };

    const result = ruleGroupIdentifierV2toV1(identifier);
    expect(result).toStrictEqual<RuleGroupIdentifier>({
      dataSourceName: 'grafana',
      groupName: 'group-1',
      namespaceName: 'uid123',
    });
  });

  it('should convert data source v2 rule group identifier to v1 format', () => {
    const identifier: RuleGroupIdentifierV2 = {
      groupName: 'group-1',
      namespace: {
        name: 'namespace-1',
      },
      rulesSource: {
        uid: 'ds-uid123',
        name: 'ds-name',
        ruleSourceType: 'datasource',
      },
      groupOrigin: 'datasource',
    };

    const result = ruleGroupIdentifierV2toV1(identifier);
    expect(result).toStrictEqual<RuleGroupIdentifier>({
      dataSourceName: 'ds-name',
      groupName: 'group-1',
      namespaceName: 'namespace-1',
    });
  });
});
