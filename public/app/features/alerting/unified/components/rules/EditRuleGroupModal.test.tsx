import { render } from 'test/test-utils';
import { byLabelText, byTestId, byText, byTitle } from 'testing-library-selector';

import { CombinedRuleNamespace, RuleGroupIdentifier } from 'app/types/unified-alerting';

import { GRAFANA_RULER_CONFIG } from '../../api/featureDiscoveryApi';
import { setupMswServer } from '../../mockApi';
import {
  mockCombinedRule,
  mockCombinedRuleNamespace,
  mockPromAlertingRule,
  mockPromRecordingRule,
  mockRulerAlertingRule,
  mockRulerRecordingRule,
} from '../../mocks';
import { mimirDataSource } from '../../mocks/server/configure';
import { setupDataSources } from '../../testSetup/datasources';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { EditRuleGroupModal } from './EditRuleGroupModal';

const ui = {
  input: {
    namespace: byLabelText(/^Folder|^Namespace/, { exact: true }),
    group: byLabelText(/Evaluation group/),
    interval: byLabelText(/Evaluation interval/),
  },
  folderLink: byTitle(/Go to folder/), // <a> without a href has the generic role
  table: byTestId('dynamic-table'),
  tableRows: byTestId('row'),
  noRulesText: byText('This group does not contain alert rules.'),
};

const noop = () => jest.fn();
setupMswServer();

describe('EditGroupModal', () => {
  const { dataSource, rulerConfig } = mimirDataSource();
  setupDataSources(dataSource);

  it('Should disable all inputs but interval when intervalEditOnly is set', async () => {
    const rulerGroupIdentifier: RuleGroupIdentifier = {
      dataSourceName: dataSource.name,
      groupName: 'default-group',
      namespaceName: 'my-namespace',
    };

    render(
      <EditRuleGroupModal
        ruleGroupIdentifier={rulerGroupIdentifier}
        intervalEditOnly
        onClose={noop}
        rulerConfig={rulerConfig}
      />
    );

    expect(await ui.input.namespace.find()).toHaveAttribute('readonly');
    expect(ui.input.group.get()).toHaveAttribute('readonly');
    expect(ui.input.interval.get()).not.toHaveAttribute('readonly');
  });
});

describe('EditGroupModal component on cloud alert rules', () => {
  const { dataSource, rulerConfig } = mimirDataSource();
  setupDataSources(dataSource);

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

  it('Should show alert table in case of having some non-recording rules in the group', async () => {
    const promNs = mockCombinedRuleNamespace({
      name: 'prometheus-ns',
      rulesSource: dataSource,
      groups: [
        { name: 'default-group', interval: '90s', rules: [alertingRule, recordingRule1, recordingRule2], totals: {} },
      ],
    });

    const ruleGroupIdentifier: RuleGroupIdentifier = {
      dataSourceName: dataSource.name,
      groupName: promNs.groups[0].name,
      namespaceName: promNs.name,
    };

    render(<EditRuleGroupModal ruleGroupIdentifier={ruleGroupIdentifier} rulerConfig={rulerConfig} onClose={noop} />);

    expect(await ui.input.namespace.find()).toHaveValue('prometheus-ns');
    expect(ui.input.namespace.get()).not.toHaveAttribute('readonly');
    expect(ui.input.group.get()).toHaveValue('default-group');

    expect(ui.tableRows.getAll()).toHaveLength(1); // Only one rule is non-recording
    expect(ui.tableRows.getAll()[0]).toHaveTextContent('alerting-rule-cpu');
  });

  it('Should not show alert table in case of having exclusively recording rules in the group', async () => {
    const promNs = mockCombinedRuleNamespace({
      name: 'prometheus-ns',
      rulesSource: dataSource,
      groups: [{ name: 'default-group', interval: '90s', rules: [recordingRule1, recordingRule2], totals: {} }],
    });

    const ruleGroupIdentifier: RuleGroupIdentifier = {
      dataSourceName: dataSource.name,
      groupName: promNs.groups[0].name,
      namespaceName: promNs.name,
    };

    render(<EditRuleGroupModal rulerConfig={rulerConfig} ruleGroupIdentifier={ruleGroupIdentifier} onClose={noop} />);
    expect(ui.table.query()).not.toBeInTheDocument();
    expect(await ui.noRulesText.find()).toBeInTheDocument();
  });
});

describe('EditGroupModal component on grafana-managed alert rules', () => {
  const grafanaNamespace: CombinedRuleNamespace = {
    name: 'namespace1',
    rulesSource: 'grafana',
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
        totals: {},
      },
    ],
  };

  const grafanaGroup1 = grafanaNamespace.groups[0];
  const ruleGroupIdentifier: RuleGroupIdentifier = {
    dataSourceName: GRAFANA_RULES_SOURCE_NAME,
    groupName: grafanaGroup1.name,
    namespaceName: grafanaNamespace.name,
  };

  const renderWithGrafanaGroup = () =>
    render(
      <EditRuleGroupModal ruleGroupIdentifier={ruleGroupIdentifier} rulerConfig={GRAFANA_RULER_CONFIG} onClose={noop} />
    );

  it('Should show alert table', async () => {
    renderWithGrafanaGroup();

    expect(await ui.input.namespace.find()).toHaveValue('namespace1');
    expect(ui.input.group.get()).toHaveValue('grafanaGroup1');
    expect(ui.input.interval.get()).toHaveValue('30s');

    expect(ui.tableRows.getAll()).toHaveLength(2);
    expect(ui.tableRows.getAll()[0]).toHaveTextContent('high-cpu-1');
    expect(ui.tableRows.getAll()[1]).toHaveTextContent('high-memory');
  });

  it('Should have folder input in readonly mode', async () => {
    renderWithGrafanaGroup();

    expect(await ui.input.namespace.find()).toHaveAttribute('readonly');
  });

  it('Should not display folder link if no folderUrl provided', async () => {
    renderWithGrafanaGroup();
    expect(await ui.input.namespace.find()).toHaveValue('namespace1');
    expect(ui.folderLink.query()).not.toBeInTheDocument();
  });
});
