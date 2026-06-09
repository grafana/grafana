import { HttpResponse, http } from 'msw';

import {
  type AlertRule,
  type RecordingRule,
  type RuleSequence,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { filterBySelector } from 'app/features/alerting/unified/mocks/server/handlers/k8s/utils';

const RULES_API_DEFAULT_NAMESPACE_URL = '/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default';

/** UID of a rule sequence */
export const RULE_SEQUENCE_UID_1 = 'seq-uid-1';

/** UID of alert rules */
export const ALERT_RULE_UID_1 = 'alert-rule-uid-1';
export const ALERT_RULE_UID_2 = 'alert-rule-uid-2';

/** UID of recording rules */
export const RECORDING_RULE_UID_1 = 'recording-rule-uid-1';

/**
 * Helper to create a Kubernetes-style response for rules API
 * Follows the same pattern as getK8sResponse but with rules API version
 */
function getRulesK8sResponse<T>(kind: string, items: T[]) {
  return {
    kind,
    apiVersion: 'rules.alerting.grafana.app/v0alpha1',
    metadata: {},
    items,
  };
}

// Default fixtures
const defaultRuleSequence: RuleSequence = {
  apiVersion: 'rules.alerting.grafana.app/v0alpha1',
  kind: 'RuleSequence',
  metadata: {
    name: RULE_SEQUENCE_UID_1,
    namespace: 'default',
    uid: RULE_SEQUENCE_UID_1,
    resourceVersion: 'e0270bfced786660',
  },
  spec: {
    trigger: { interval: '1m' },
    recordingRules: [{ name: RECORDING_RULE_UID_1 }],
    alertingRules: [{ name: ALERT_RULE_UID_1 }, { name: ALERT_RULE_UID_2 }],
  },
};

const defaultAlertRules: AlertRule[] = [
  {
    apiVersion: 'rules.alerting.grafana.app/v0alpha1',
    kind: 'AlertRule',
    metadata: {
      name: ALERT_RULE_UID_1,
      namespace: 'default',
      uid: ALERT_RULE_UID_1,
      resourceVersion: 'e0270bfced786661',
    },
    spec: {
      title: 'CPU alert',
      execErrState: 'Error',
      noDataState: 'NoData',
      expressions: {},
      trigger: { interval: '1m' },
    },
  },
  {
    apiVersion: 'rules.alerting.grafana.app/v0alpha1',
    kind: 'AlertRule',
    metadata: {
      name: ALERT_RULE_UID_2,
      namespace: 'default',
      uid: ALERT_RULE_UID_2,
      resourceVersion: 'e0270bfced786662',
    },
    spec: {
      title: 'Memory alert',
      execErrState: 'Error',
      noDataState: 'NoData',
      expressions: {},
      trigger: { interval: '1m' },
    },
  },
];

const defaultRecordingRule: RecordingRule = {
  apiVersion: 'rules.alerting.grafana.app/v0alpha1',
  kind: 'RecordingRule',
  metadata: {
    name: RECORDING_RULE_UID_1,
    namespace: 'default',
    uid: RECORDING_RULE_UID_1,
    resourceVersion: 'e0270bfced786663',
  },
  spec: {
    metric: 'cpu:usage:5m',
    targetDatasourceUID: 'default',
    title: 'CPU usage recording',
    expressions: {},
    trigger: { interval: '1m' },
  },
};

// In-memory fixtures for tests
const allRuleSequences = getRulesK8sResponse<RuleSequence>('RuleSequenceList', [defaultRuleSequence]);
const allAlertRules = getRulesK8sResponse<AlertRule>('AlertRuleList', defaultAlertRules);
const allRecordingRules = getRulesK8sResponse<RecordingRule>('RecordingRuleList', [defaultRecordingRule]);

const getSequenceByName = (name: string) => {
  return allRuleSequences.items.find((seq) => seq.metadata.name === name);
};

export const listNamespacedRuleSequencesHandler = () =>
  http.get(`${RULES_API_DEFAULT_NAMESPACE_URL}/rulesequences`, ({ request }) => {
    const url = new URL(request.url);
    const fieldSelector = url.searchParams.get('fieldSelector');

    if (fieldSelector && fieldSelector.includes('metadata.name')) {
      const filteredItems = filterBySelector(allRuleSequences.items, fieldSelector);
      return HttpResponse.json({ items: filteredItems });
    }

    return HttpResponse.json(allRuleSequences);
  });

export const getNamespacedRuleSequenceHandler = () =>
  http.get(`${RULES_API_DEFAULT_NAMESPACE_URL}/rulesequences/:name`, ({ params }) => {
    const { name } = params;
    if (typeof name !== 'string') {
      return HttpResponse.json({}, { status: 400 });
    }
    const matchingSequence = getSequenceByName(name);

    if (!matchingSequence) {
      return HttpResponse.json({}, { status: 404 });
    }

    return HttpResponse.json(matchingSequence);
  });

export const listNamespacedAlertRulesHandler = () =>
  http.get(`${RULES_API_DEFAULT_NAMESPACE_URL}/alertrules`, ({ request }) => {
    const url = new URL(request.url);
    const fieldSelector = url.searchParams.get('fieldSelector');

    if (fieldSelector && fieldSelector.includes('metadata.name')) {
      const filteredItems = filterBySelector(allAlertRules.items, fieldSelector);
      return HttpResponse.json({ items: filteredItems });
    }

    return HttpResponse.json(allAlertRules);
  });

export const listNamespacedRecordingRulesHandler = () =>
  http.get(`${RULES_API_DEFAULT_NAMESPACE_URL}/recordingrules`, ({ request }) => {
    const url = new URL(request.url);
    const fieldSelector = url.searchParams.get('fieldSelector');

    if (fieldSelector && fieldSelector.includes('metadata.name')) {
      const filteredItems = filterBySelector(allRecordingRules.items, fieldSelector);
      return HttpResponse.json({ items: filteredItems });
    }

    return HttpResponse.json(allRecordingRules);
  });

const handlers = [
  listNamespacedRuleSequencesHandler(),
  getNamespacedRuleSequenceHandler(),
  listNamespacedAlertRulesHandler(),
  listNamespacedRecordingRulesHandler(),
];

export default handlers;
