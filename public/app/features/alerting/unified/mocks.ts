import { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';
import { AlertingRule, Alert, RecordingRule, RuleGroup, RuleNamespace } from 'app/types/unified-alerting';

let nextDataSourceId = 1;

export const mockDataSource = (partial: Partial<DataSourceInstanceSettings> = {}): DataSourceInstanceSettings => {
  const id = partial.id ?? nextDataSourceId++;

  return {
    id,
    uid: `mock-ds-${nextDataSourceId}`,
    type: 'prometheus',
    name: `Prometheus-${id}`,
    jsonData: {},
    meta: ({
      info: {
        logos: {
          small: 'https://prometheus.io/assets/prometheus_logo_grey.svg',
          large: 'https://prometheus.io/assets/prometheus_logo_grey.svg',
        },
      },
    } as any) as DataSourcePluginMeta,
    ...partial,
  };
};

export const mockPromAlert = (partial: Partial<Alert> = {}): Alert => ({
  activeAt: '2021-03-18T13:47:05.04938691Z',
  annotations: {
    message: 'alert with severity "warning"',
  },
  labels: {
    alertname: 'myalert',
    severity: 'warning',
  },
  state: PromAlertingRuleState.Firing,
  value: '1e+00',
  ...partial,
});

export const mockPromAlertingRule = (partial: Partial<AlertingRule> = {}): AlertingRule => {
  return {
    type: PromRuleType.Alerting,
    alerts: [mockPromAlert()],
    name: 'myalert',
    query: 'foo > 1',
    lastEvaluation: '2021-03-23T08:19:05.049595312Z',
    evaluationTime: 0.000395601,
    annotations: {
      message: 'alert with severity "{{.warning}}}"',
    },
    labels: {
      severity: 'warning',
    },
    state: PromAlertingRuleState.Firing,
    health: 'OK',
    ...partial,
  };
};

export const mockPromRecordingRule = (partial: Partial<RecordingRule> = {}): RecordingRule => {
  return {
    type: PromRuleType.Recording,
    query: 'bar < 3',
    labels: {
      cluster: 'eu-central',
    },
    health: 'OK',
    name: 'myrecordingrule',
    lastEvaluation: '2021-03-23T08:19:05.049595312Z',
    evaluationTime: 0.000395601,
    ...partial,
  };
};

export const mockPromRuleGroup = (partial: Partial<RuleGroup> = {}): RuleGroup => {
  return {
    name: 'mygroup',
    interval: 60,
    rules: [mockPromAlertingRule()],
    ...partial,
  };
};

export const mockPromRuleNamespace = (partial: Partial<RuleNamespace> = {}): RuleNamespace => {
  return {
    dataSourceName: 'Prometheus-1',
    name: 'default',
    groups: [mockPromRuleGroup()],
    ...partial,
  };
};
