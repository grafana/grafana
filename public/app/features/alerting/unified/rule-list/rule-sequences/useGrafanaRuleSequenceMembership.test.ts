import { getWrapper, renderHook, testWithFeatureToggles, waitFor } from 'test/test-utils';

import type { RuleSequence } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { type GrafanaPromRuleDTO, PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../mockApi';
import {
  ALERT_RULE_UID_1,
  ALERT_RULE_UID_2,
  RECORDING_RULE_UID_1,
  RULE_SEQUENCE_FOLDER_UID_1,
  RULE_SEQUENCE_UID_1,
} from '../../mocks/server/handlers/k8s/ruleSequences.k8s';

import { buildSequenceMembershipLookup, useGrafanaRuleSequenceMembership } from './useGrafanaRuleSequenceMembership';

setupMswServer();

describe('buildSequenceMembershipLookup', () => {
  it('returns empty map for empty sequences array', () => {
    const lookup = buildSequenceMembershipLookup([]);
    expect(lookup.size).toBe(0);
  });

  it('maps every rule UID in the sequence to the correct sequence id', () => {
    const sequence: RuleSequence = {
      apiVersion: 'rules.alerting.grafana.app/v0alpha1',
      kind: 'RuleSequence',
      metadata: {
        name: RULE_SEQUENCE_UID_1,
        namespace: 'default',
      },
      spec: {
        trigger: { interval: '1m' },
        recordingRules: [{ name: RECORDING_RULE_UID_1 }],
        alertingRules: [{ name: ALERT_RULE_UID_1 }, { name: ALERT_RULE_UID_2 }],
      },
    };

    const lookup = buildSequenceMembershipLookup([sequence]);

    expect(lookup.get(RECORDING_RULE_UID_1)).toEqual({ id: RULE_SEQUENCE_UID_1 });
    expect(lookup.get(ALERT_RULE_UID_1)).toEqual({ id: RULE_SEQUENCE_UID_1 });
    expect(lookup.get(ALERT_RULE_UID_2)).toEqual({ id: RULE_SEQUENCE_UID_1 });
  });

  it('returns undefined for a rule UID not in any sequence', () => {
    const sequence: RuleSequence = {
      apiVersion: 'rules.alerting.grafana.app/v0alpha1',
      kind: 'RuleSequence',
      metadata: {
        name: RULE_SEQUENCE_UID_1,
        namespace: 'default',
      },
      spec: {
        trigger: { interval: '1m' },
        recordingRules: [{ name: RECORDING_RULE_UID_1 }],
        alertingRules: [{ name: ALERT_RULE_UID_1 }],
      },
    };

    const lookup = buildSequenceMembershipLookup([sequence]);

    expect(lookup.get('unknown-uid')).toBeUndefined();
  });

  it('returns the last-written entry when a rule appears in multiple sequences', () => {
    const sequence1: RuleSequence = {
      apiVersion: 'rules.alerting.grafana.app/v0alpha1',
      kind: 'RuleSequence',
      metadata: { name: 'seq-1', namespace: 'default' },
      spec: {
        trigger: { interval: '1m' },
        recordingRules: [{ name: RECORDING_RULE_UID_1 }],
        alertingRules: [],
      },
    };

    const sequence2: RuleSequence = {
      apiVersion: 'rules.alerting.grafana.app/v0alpha1',
      kind: 'RuleSequence',
      metadata: { name: 'seq-2', namespace: 'default' },
      spec: {
        trigger: { interval: '1m' },
        recordingRules: [{ name: RECORDING_RULE_UID_1 }],
        alertingRules: [],
      },
    };

    const lookup = buildSequenceMembershipLookup([sequence1, sequence2]);

    expect(lookup.get(RECORDING_RULE_UID_1)).toEqual({ id: 'seq-2' });
  });

  it('memoizes results based on array reference', () => {
    const sequences: RuleSequence[] = [
      {
        apiVersion: 'rules.alerting.grafana.app/v0alpha1',
        kind: 'RuleSequence',
        metadata: { name: RULE_SEQUENCE_UID_1, namespace: 'default' },
        spec: {
          trigger: { interval: '1m' },
          recordingRules: [{ name: RECORDING_RULE_UID_1 }],
          alertingRules: [],
        },
      },
    ];

    const result1 = buildSequenceMembershipLookup(sequences);
    const result2 = buildSequenceMembershipLookup(sequences);

    expect(result1).toBe(result2);
  });
});

describe('useGrafanaRuleSequenceMembership', () => {
  const grafanaRule: GrafanaPromRuleDTO = {
    name: 'CPU alert',
    uid: ALERT_RULE_UID_1,
    query: '',
    folderUid: RULE_SEQUENCE_FOLDER_UID_1,
    isPaused: false,
    health: 'ok',
    state: PromAlertingRuleState.Inactive,
    type: PromRuleType.Alerting,
    totals: {},
    totalsFiltered: {},
  };

  const wrapper = getWrapper({ renderWithRouter: true });

  describe('when the rules API v2 toggle is enabled', () => {
    testWithFeatureToggles({ enable: ['alerting.rulesAPIV2'] });

    it('returns the sequence membership for a rule in the folder', async () => {
      const { result } = renderHook(
        () => useGrafanaRuleSequenceMembership({ rule: grafanaRule, namespaceUid: RULE_SEQUENCE_FOLDER_UID_1 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current).toEqual({ id: RULE_SEQUENCE_UID_1 });
      });
    });

    it('does not return membership when scoped to a folder without the sequence', async () => {
      const { result } = renderHook(
        () => useGrafanaRuleSequenceMembership({ rule: grafanaRule, namespaceUid: 'other-folder-uid' }),
        { wrapper }
      );

      // Give the scoped (and empty) query time to resolve before asserting it stays undefined.
      await waitFor(() => {
        expect(result.current).toBeUndefined();
      });
    });
  });

  describe('when the rules API v2 toggle is disabled', () => {
    testWithFeatureToggles({ disable: ['alerting.rulesAPIV2'] });

    it('does not query and returns undefined', () => {
      const { result } = renderHook(
        () => useGrafanaRuleSequenceMembership({ rule: grafanaRule, namespaceUid: RULE_SEQUENCE_FOLDER_UID_1 }),
        { wrapper }
      );

      expect(result.current).toBeUndefined();
    });
  });
});
