import { getWrapper, renderHook, waitFor } from 'test/test-utils';

import {
  type AlertRule,
  type RecordingRule,
  generatedAPI as rulesAPIv0alpha1,
} from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { configureStore } from 'app/store/configureStore';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

import {
  buildAlertRuleResource,
  buildRecordingRuleResource,
} from '../components/rule-editor/alert-rule-form/formValuesToAppPlatform';
import { setupMswServer } from '../mockApi';
import { mockDataQuery, mockDataSource, mockReduceExpression, mockThresholdExpression } from '../mocks';
import { getAlertRuleHandler, mockK8sAlertRule } from '../mocks/server/handlers/k8s/alertRules.k8s';
import { setupDataSources } from '../testSetup/datasources';
import { RuleFormType, type RuleFormValues } from '../types/rule-form';
import { rulerRuleToFormValues } from '../utils/rule-form';
import { isUngroupedRuleGroup } from '../utils/rules';

import { getDefaultFormValues } from './formDefaults';
import { belongedToGroup, k8sRuleToRuleWithLocation, useK8sRuleWithLocation } from './useK8sRuleWithLocation';

const server = setupMswServer();

setupDataSources(mockDataSource({ uid: 'abc123', type: 'prometheus' }));

const folder = { title: 'folder-uid', uid: 'folder-uid' };

const alertValues: RuleFormValues = {
  ...getDefaultFormValues(),
  type: RuleFormType.grafana,
  name: 'CPU high',
  folder,
  queries: [
    { ...mockDataQuery(), relativeTimeRange: { from: 600, to: 0 } },
    mockReduceExpression({ expression: 'A' }),
    mockThresholdExpression({ expression: 'B' }),
  ],
  condition: 'C',
  evaluateEvery: '2m',
  evaluateFor: '5m',
  keepFiringFor: '1m',
  noDataState: GrafanaAlertStateDecision.OK,
  execErrState: GrafanaAlertStateDecision.Alerting,
  labels: [{ key: 'team', value: 'alerting' }],
  annotations: [{ key: 'summary', value: 'CPU is high' }],
  manualRouting: true,
  contactPoints: {
    grafana: {
      selectedContactPoint: 'email',
      overrideGrouping: true,
      groupBy: ['alertname'],
      overrideTimings: false,
      groupWaitValue: '',
      groupIntervalValue: '',
      repeatIntervalValue: '',
      muteTimeIntervals: [],
      activeTimeIntervals: [],
    },
  },
};

const recordingValues: RuleFormValues = {
  ...getDefaultFormValues(RuleFormType.grafanaRecording),
  type: RuleFormType.grafanaRecording,
  name: 'CPU ratio',
  folder,
  queries: [mockDataQuery()],
  condition: 'A',
  evaluateEvery: '4m',
  metric: 'cpu_ratio',
  targetDatasourceUid: 'prom-uid',
  labels: [{ key: 'team', value: 'alerting' }],
};

function asSaved<T extends AlertRule | RecordingRule>(resource: T, labels: Record<string, string> = {}): T {
  return { ...resource, metadata: { ...resource.metadata, labels: { ...resource.metadata.labels, ...labels } } };
}

describe('k8sRuleToRuleWithLocation', () => {
  it('loads an alert rule into the same form values it was saved from', () => {
    const resource = asSaved(buildAlertRuleResource(alertValues, 'rule-uid', 'v0alpha1') as AlertRule);

    const formValues = rulerRuleToFormValues(k8sRuleToRuleWithLocation(resource));

    expect(formValues).toMatchObject({
      name: alertValues.name,
      folder,
      queries: alertValues.queries,
      condition: 'C',
      evaluateEvery: '2m',
      evaluateFor: '5m',
      keepFiringFor: '1m',
      noDataState: GrafanaAlertStateDecision.OK,
      execErrState: GrafanaAlertStateDecision.Alerting,
      manualRouting: true,
      contactPoints: { grafana: { selectedContactPoint: 'email', overrideGrouping: true, groupBy: ['alertname'] } },
      isUngroupedRuleGroup: true,
    });
    expect(formValues.labels).toEqual(expect.arrayContaining(alertValues.labels));
    expect(formValues.annotations).toEqual(expect.arrayContaining(alertValues.annotations));
  });

  it('loads a recording rule into the same form values it was saved from', () => {
    const resource = asSaved(buildRecordingRuleResource(recordingValues, 'rec-uid', 'v0alpha1') as RecordingRule);

    const formValues = rulerRuleToFormValues(k8sRuleToRuleWithLocation(resource));

    expect(formValues).toMatchObject({
      type: RuleFormType.grafanaRecording,
      name: 'CPU ratio',
      queries: recordingValues.queries,
      condition: 'A',
      evaluateEvery: '4m',
      metric: 'cpu_ratio',
      targetDatasourceUid: 'prom-uid',
    });
    expect(formValues.labels).toEqual(expect.arrayContaining(recordingValues.labels));
  });

  it('opens queries that fit the simple editor in the simple editor', () => {
    const resource = asSaved(buildAlertRuleResource(alertValues, 'rule-uid', 'v0alpha1') as AlertRule);

    const { editorSettings } = rulerRuleToFormValues(k8sRuleToRuleWithLocation(resource));

    expect(editorSettings?.simplifiedQueryEditor).toBe(true);
  });

  it('opens queries that do not fit the simple editor in the advanced editor', () => {
    const twoDataQueries = {
      ...alertValues,
      queries: [mockDataQuery(), mockDataQuery({ refId: 'D' }), ...alertValues.queries.slice(1)],
    };
    const resource = asSaved(buildAlertRuleResource(twoDataQueries, 'rule-uid', 'v0alpha1') as AlertRule);

    const { editorSettings } = rulerRuleToFormValues(k8sRuleToRuleWithLocation(resource));

    expect(editorSettings?.simplifiedQueryEditor).toBe(false);
  });

  it('shows Go-formatted durations the way the editor writes them', () => {
    const saved = asSaved(buildAlertRuleResource(alertValues, 'rule-uid', 'v0alpha1') as AlertRule);
    const resource = { ...saved, spec: { ...saved.spec, for: '40m0s', keepFiringFor: '1h0m0s' } };

    const { evaluateFor, keepFiringFor } = rulerRuleToFormValues(k8sRuleToRuleWithLocation(resource));

    expect({ evaluateFor, keepFiringFor }).toEqual({ evaluateFor: '40m', keepFiringFor: '1h' });
  });

  it('puts a rule that was in a group directly in its folder', () => {
    const resource = asSaved(buildAlertRuleResource(alertValues, 'rule-uid', 'v0alpha1') as AlertRule, {
      'grafana.com/group': 'cpu-group',
    });

    const { group } = k8sRuleToRuleWithLocation(resource);

    expect(isUngroupedRuleGroup(group.name)).toBe(true);
    expect(belongedToGroup(resource)).toBe(true);
  });
});

describe('useK8sRuleWithLocation', () => {
  it('ignores a cached copy of the rule and waits for the one fetched when the editor opens', async () => {
    const withVersion = (title: string, resourceVersion: string) => {
      const rule = mockK8sAlertRule({ uid: 'rule-uid', title });
      return { ...rule, metadata: { ...rule.metadata, resourceVersion } };
    };
    const store = configureStore();
    await store.dispatch(
      rulesAPIv0alpha1.util.upsertQueryData('getAlertRule', { name: 'rule-uid' }, withVersion('cached title', '7'))
    );
    server.use(getAlertRuleHandler([withVersion('server title', '8')]));

    const { result } = renderHook(() => useK8sRuleWithLocation('rule-uid', 'alert'), {
      wrapper: getWrapper({ store }),
    });

    expect(result.current).toEqual({ loading: true });
    await waitFor(() => expect(result.current.resource?.metadata.resourceVersion).toBe('8'));
    expect(result.current.result?.rule).toMatchObject({ grafana_alert: { title: 'server title' } });
  });

  it('reports a cached rule deleted since as not found', async () => {
    const store = configureStore();
    await store.dispatch(
      rulesAPIv0alpha1.util.upsertQueryData(
        'getAlertRule',
        { name: 'rule-uid' },
        mockK8sAlertRule({ uid: 'rule-uid', title: 'cached title' })
      )
    );
    server.use(getAlertRuleHandler([]));

    const { result } = renderHook(() => useK8sRuleWithLocation('rule-uid', 'alert'), {
      wrapper: getWrapper({ store }),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toEqual({ loading: false, error: undefined });
  });
});
