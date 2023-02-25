import { render } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { byLabelText, byTestId, byText, byTitle } from 'testing-library-selector';

import { CombinedRuleNamespace } from 'app/types/unified-alerting';

import {
  mockCombinedRule,
  mockCombinedRuleNamespace,
  mockDataSource,
  mockPromAlertingRule,
  mockPromRecordingRule,
  mockRulerAlertingRule,
  mockRulerRecordingRule,
  mockRulerRuleGroup,
  mockStore,
} from '../../mocks';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { EditCloudGroupModal } from './EditRuleGroupModal';

const ui = {
  input: {
    namespace: byLabelText(/^Folder|^Namespace/, { exact: true }),
    group: byLabelText(/Evaluation group/),
    interval: byLabelText(/Rule group evaluation interval/),
  },
  folderLink: byTitle(/Go to folder/), // <a> without a href has the generic role
  table: byTestId('dynamic-table'),
  tableRows: byTestId('row'),
  noRulesText: byText('This group does not contain alert rules.'),
};
mockRulerRuleGroup({
  name: 'group1',
  rules: [
    mockRulerRecordingRule({
      record: 'instance:node_num_cpu:sum',
      expr: 'count without (cpu) (count without (mode) (node_cpu_seconds_total{job="integrations/node_exporter"}))',
      labels: { type: 'cpu' },
    }),
    mockRulerAlertingRule({ alert: 'nonRecordingRule' }),
  ],
});

jest.mock('app/types', () => ({
  ...jest.requireActual('app/types'),
  useDispatch: () => jest.fn(),
}));

function getProvidersWrapper() {
  return function Wrapper({ children }: React.PropsWithChildren<{}>) {
    const store = mockStore(() => null);
    return <Provider store={store}>{children}</Provider>;
  };
}

describe('EditGroupModal', () => {
  it('Should disable all inputs but interval when intervalEditOnly is set', () => {
    const namespace = mockCombinedRuleNamespace({
      name: 'my-alerts',
      rulesSource: mockDataSource(),
      groups: [{ name: 'default-group', interval: '90s', rules: [] }],
    });

    const group = namespace.groups[0];

    render(<EditCloudGroupModal namespace={namespace} group={group} intervalEditOnly onClose={() => jest.fn()} />, {
      wrapper: getProvidersWrapper(),
    });

    expect(ui.input.namespace.get()).toHaveAttribute('readonly');
    expect(ui.input.group.get()).toHaveAttribute('readonly');
    expect(ui.input.interval.get()).not.toHaveAttribute('readonly');
  });
});

describe('EditGroupModal component on cloud alert rules', () => {
  const promDsSettings = mockDataSource({ name: 'Prometheus-1', uid: 'Prometheus-1' });

  const alertingRule = mockCombinedRule({
    namespace: undefined,
    promRule: mockPromAlertingRule({ name: 'alerting-rule-cpu' }),
    rulerRule: mockRulerAlertingRule({ alert: 'alerting-rule-cpu' }),
  });

  const recordingRule1 = mockCombinedRule({
    namespace: undefined,
    promRule: mockPromRecordingRule({ name: 'recording-rule-memory' }),
    rulerRule: mockRulerRecordingRule({ record: 'recording-rule-memory' }),
  });

  const recordingRule2 = mockCombinedRule({
    namespace: undefined,
    promRule: mockPromRecordingRule({ name: 'recording-rule-cpu' }),
    rulerRule: mockRulerRecordingRule({ record: 'recording-rule-cpu' }),
  });

  it('Should show alert table in case of having some non-recording rules in the group', () => {
    const promNs = mockCombinedRuleNamespace({
      name: 'prometheus-ns',
      rulesSource: promDsSettings,
      groups: [{ name: 'default-group', interval: '90s', rules: [alertingRule, recordingRule1, recordingRule2] }],
    });

    const group = promNs.groups[0];

    render(<EditCloudGroupModal namespace={promNs} group={group} onClose={() => jest.fn()} />, {
      wrapper: getProvidersWrapper(),
    });

    expect(ui.input.namespace.get()).toHaveValue('prometheus-ns');
    expect(ui.input.namespace.get()).not.toHaveAttribute('readonly');
    expect(ui.input.group.get()).toHaveValue('default-group');

    expect(ui.tableRows.getAll()).toHaveLength(1); // Only one rule is non-recording
    expect(ui.tableRows.getAll()[0]).toHaveTextContent('alerting-rule-cpu');
  });

  it('Should not show alert table in case of having exclusively recording rules in the group', () => {
    const promNs = mockCombinedRuleNamespace({
      name: 'prometheus-ns',
      rulesSource: promDsSettings,
      groups: [{ name: 'default-group', interval: '90s', rules: [recordingRule1, recordingRule2] }],
    });

    const group = promNs.groups[0];

    render(<EditCloudGroupModal namespace={promNs} group={group} onClose={jest.fn()} />, {
      wrapper: getProvidersWrapper(),
    });
    expect(ui.table.query()).not.toBeInTheDocument();
    expect(ui.noRulesText.get()).toBeInTheDocument();
  });
});

describe('EditGroupModal component on grafana-managed alert rules', () => {
  const grafanaNamespace: CombinedRuleNamespace = {
    name: 'namespace1',
    rulesSource: GRAFANA_RULES_SOURCE_NAME,
    groups: [
      {
        name: 'grafanaGroup1',
        interval: '30s',
        rules: [
          mockCombinedRule({
            namespace: undefined,
            promRule: mockPromAlertingRule({ name: 'high-cpu-1' }),
            rulerRule: mockRulerAlertingRule({ alert: 'high-cpu-1' }),
          }),
          mockCombinedRule({
            namespace: undefined,
            promRule: mockPromAlertingRule({ name: 'high-memory' }),
            rulerRule: mockRulerAlertingRule({ alert: 'high-memory' }),
          }),
        ],
      },
    ],
  };

  const grafanaGroup1 = grafanaNamespace.groups[0];

  it('Should show alert table', () => {
    render(<EditCloudGroupModal namespace={grafanaNamespace} group={grafanaGroup1} onClose={jest.fn()} />, {
      wrapper: getProvidersWrapper(),
    });

    expect(ui.input.namespace.get()).toHaveValue('namespace1');
    expect(ui.input.group.get()).toHaveValue('grafanaGroup1');
    expect(ui.input.interval.get()).toHaveValue('30s');

    expect(ui.tableRows.getAll()).toHaveLength(2);
    expect(ui.tableRows.getAll()[0]).toHaveTextContent('high-cpu-1');
    expect(ui.tableRows.getAll()[1]).toHaveTextContent('high-memory');
  });

  it('Should have folder input in readonly mode', () => {
    render(<EditCloudGroupModal namespace={grafanaNamespace} group={grafanaGroup1} onClose={jest.fn()} />, {
      wrapper: getProvidersWrapper(),
    });

    expect(ui.input.namespace.get()).toHaveAttribute('readonly');
  });

  it('Should not display folder link if no folderUrl provided', () => {
    render(<EditCloudGroupModal namespace={grafanaNamespace} group={grafanaGroup1} onClose={jest.fn()} />, {
      wrapper: getProvidersWrapper(),
    });

    expect(ui.folderLink.query()).not.toBeInTheDocument();
  });
});
