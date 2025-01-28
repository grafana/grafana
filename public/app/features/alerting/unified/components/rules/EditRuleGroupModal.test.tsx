import { HttpResponse } from 'msw';
import { render } from 'test/test-utils';
import { byLabelText, byTestId, byText, byTitle } from 'testing-library-selector';

import { AccessControlAction } from 'app/types';
import { RuleGroupIdentifier } from 'app/types/unified-alerting';

import { GRAFANA_RULER_CONFIG } from '../../api/featureDiscoveryApi';
import server, { setupMswServer } from '../../mockApi';
import { mimirDataSource } from '../../mocks/server/configure';
import { alertingFactory } from '../../mocks/server/db';
import { rulerRuleGroupHandler as grafanaRulerRuleGroupHandler } from '../../mocks/server/handlers/grafanaRuler';
import { rulerRuleGroupHandler } from '../../mocks/server/handlers/mimirRuler';
import { grantPermissionsHelper } from '../../test/test-utils';
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

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useReturnToPrevious: jest.fn(),
}));

describe('EditGroupModal component on cloud alert rules', () => {
  it('Should disable all inputs but interval when intervalEditOnly is set', async () => {
    const { rulerConfig } = mimirDataSource();

    const group = alertingFactory.ruler.group.build({
      rules: [alertingFactory.ruler.alertingRule.build(), alertingFactory.ruler.recordingRule.build()],
    });

    // @TODO need to simplify this a bit I think, ideally there would be a higher-level function that simply sets up a few rules
    // and attaches the ruler and prometheus endpoint(s) – including the namespaces and group endpoints.
    server.use(
      rulerRuleGroupHandler({
        response: HttpResponse.json(group),
      })
    );

    const rulerGroupIdentifier: RuleGroupIdentifier = {
      dataSourceName: rulerConfig.dataSourceName,
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

  it('Should show alert table in case of having some non-recording rules in the group', async () => {
    const { dataSource, rulerConfig } = mimirDataSource();

    const group = alertingFactory.ruler.group.build({
      rules: [alertingFactory.ruler.alertingRule.build(), alertingFactory.ruler.recordingRule.build()],
    });

    // @TODO need to simplify this a bit I think, ideally there would be a higher-level function that simply sets up a few rules
    // and attaches the ruler and prometheus endpoint(s) – including the namespaces and group endpoints.
    server.use(
      rulerRuleGroupHandler({
        response: HttpResponse.json(group),
      })
    );

    const ruleGroupIdentifier: RuleGroupIdentifier = {
      dataSourceName: dataSource.name,
      groupName: group.name,
      namespaceName: 'ns1',
    };

    render(<EditRuleGroupModal ruleGroupIdentifier={ruleGroupIdentifier} rulerConfig={rulerConfig} onClose={noop} />);

    expect(await ui.input.namespace.find()).toHaveValue('ns1');
    expect(ui.input.namespace.get()).not.toHaveAttribute('readonly');
    expect(ui.input.group.get()).toHaveValue(group.name);

    // @ts-ignore
    const ruleName = group.rules.at(0).alert;

    expect(ui.tableRows.getAll()).toHaveLength(1); // Only one rule is non-recording
    expect(ui.tableRows.getAll().at(0)).toHaveTextContent(ruleName);
  });

  it('Should not show alert table in case of having exclusively recording rules in the group', async () => {
    const { dataSource, rulerConfig } = mimirDataSource();

    const group = alertingFactory.ruler.group.build({
      rules: [alertingFactory.ruler.recordingRule.build(), alertingFactory.ruler.recordingRule.build()],
    });

    // @TODO need to simplify this a bit I think
    server.use(
      rulerRuleGroupHandler({
        response: HttpResponse.json(group),
      })
    );

    const ruleGroupIdentifier: RuleGroupIdentifier = {
      dataSourceName: dataSource.name,
      groupName: group.name,
      namespaceName: 'ns1',
    };

    render(<EditRuleGroupModal rulerConfig={rulerConfig} ruleGroupIdentifier={ruleGroupIdentifier} onClose={noop} />);
    expect(ui.table.query()).not.toBeInTheDocument();
    expect(await ui.noRulesText.find()).toBeInTheDocument();
  });
});

describe('EditGroupModal component on grafana-managed alert rules', () => {
  // @TODO simplify folder stuff, should also have a higher-level function to set these up
  const folder = alertingFactory.folder.build();
  const NAMESPACE_UID = folder.uid;

  const group = alertingFactory.ruler.group.build({
    rules: [alertingFactory.ruler.alertingRule.build(), alertingFactory.ruler.alertingRule.build()],
  });

  const ruleGroupIdentifier: RuleGroupIdentifier = {
    dataSourceName: GRAFANA_RULES_SOURCE_NAME,
    groupName: group.name,
    namespaceName: NAMESPACE_UID,
  };

  beforeEach(() => {
    grantPermissionsHelper([
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleUpdate,
    ]);

    server.use(
      grafanaRulerRuleGroupHandler({
        response: HttpResponse.json(group),
      })
    );
  });

  const renderWithGrafanaGroup = () =>
    render(
      <EditRuleGroupModal ruleGroupIdentifier={ruleGroupIdentifier} rulerConfig={GRAFANA_RULER_CONFIG} onClose={noop} />
    );

  it('Should show alert table', async () => {
    renderWithGrafanaGroup();

    expect(await ui.input.namespace.find()).toHaveValue(NAMESPACE_UID);
    expect(ui.input.group.get()).toHaveValue(group.name);
    expect(ui.input.interval.get()).toHaveValue(group.interval);

    expect(ui.tableRows.getAll()).toHaveLength(2);
    // @ts-ignore
    expect(ui.tableRows.getAll().at(0)).toHaveTextContent(group.rules.at(0).alert);
    // @ts-ignore
    expect(ui.tableRows.getAll().at(1)).toHaveTextContent(group.rules.at(1).alert);
  });

  it('Should have folder input in readonly mode', async () => {
    renderWithGrafanaGroup();
    expect(await ui.input.namespace.find()).toHaveAttribute('readonly');
  });

  it('Should not display folder link if no folderUrl provided', async () => {
    renderWithGrafanaGroup();
    expect(await ui.input.namespace.find()).toHaveValue(NAMESPACE_UID);
    expect(ui.folderLink.query()).not.toBeInTheDocument();
  });
});
