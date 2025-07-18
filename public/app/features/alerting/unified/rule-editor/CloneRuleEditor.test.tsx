import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { getWrapper, render, waitFor, within } from 'test/test-utils';
import { byRole, byTestId } from 'testing-library-selector';

import { MIMIR_DATASOURCE_UID } from 'app/features/alerting/unified/mocks/server/constants';
import { DashboardSearchItemType } from 'app/features/search/types';
import { AccessControlAction } from 'app/types/accessControl';
import { RuleWithLocation } from 'app/types/unified-alerting';
import {
  RulerAlertingRuleDTO,
  RulerGrafanaRuleDTO,
  RulerRecordingRuleDTO,
  RulerRuleDTO,
} from 'app/types/unified-alerting-dto';

import { ExpressionEditorProps } from '../components/rule-editor/ExpressionEditor';
import { setupMswServer } from '../mockApi';
import {
  grantUserPermissions,
  mockDataSource,
  mockFolder,
  mockRulerAlertingRule,
  mockRulerGrafanaRule,
  mockRulerRuleGroup,
} from '../mocks';
import { grafanaRulerRule } from '../mocks/grafanaRulerApi';
import { mockRulerRulesApiResponse, mockRulerRulesGroupApiResponse } from '../mocks/rulerApi';
import { setFolderResponse } from '../mocks/server/configure';
import { AlertingQueryRunner } from '../state/AlertingQueryRunner';
import { setupDataSources } from '../testSetup/datasources';
import { RuleFormValues } from '../types/rule-form';
import { Annotation } from '../utils/constants';
import { hashRulerRule } from '../utils/rule-id';

import { ExistingRuleEditor } from './ExistingRuleEditor';
import { cloneRuleDefinition } from './clone.utils';
import { getDefaultFormValues } from './formDefaults';

jest.mock('../components/rule-editor/ExpressionEditor', () => ({
  // eslint-disable-next-line react/display-name
  ExpressionEditor: ({ value, onChange }: ExpressionEditorProps) => (
    <input value={value} data-testid="expr" onChange={(e) => onChange(e.target.value)} />
  ),
}));

jest.spyOn(AlertingQueryRunner.prototype, 'run').mockImplementation(() => Promise.resolve());

const server = setupMswServer();

const ui = {
  inputs: {
    name: byRole('textbox', { name: 'name' }),
    expr: byTestId('expr'),
    folderContainer: byTestId('folder-picker'),
    namespace: byTestId('namespace-picker'),
    group: byTestId('group-picker'),
    annotationValue: (idx: number) => byTestId(`annotation-value-${idx}`),
    labelValue: (idx: number) => byTestId(`label-value-${idx}`),
  },
};

const Providers = getWrapper({ renderWithRouter: true });
function Wrapper({ children }: React.PropsWithChildren<{}>) {
  const formApi = useForm<RuleFormValues>({ defaultValues: getDefaultFormValues() });
  return (
    <Providers>
      <FormProvider {...formApi}>{children}</FormProvider>
    </Providers>
  );
}

describe('CloneRuleEditor', function () {
  const folder = {
    title: 'Folder A',
    uid: grafanaRulerRule.grafana_alert.namespace_uid,
    id: 1,
    type: DashboardSearchItemType.DashDB,
    accessControl: {
      [AccessControlAction.AlertingRuleUpdate]: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    grantUserPermissions([
      AccessControlAction.AlertingRuleRead,
      AccessControlAction.AlertingRuleCreate,
      AccessControlAction.DataSourcesRead,
      AccessControlAction.FoldersRead,
      AccessControlAction.AlertingRuleExternalRead,
      AccessControlAction.AlertingRuleExternalWrite,
    ]);

    const dataSources = {
      default: mockDataSource({
        uid: MIMIR_DATASOURCE_UID,
        type: 'prometheus',
        name: 'Mimir',
        isDefault: true,
      }),
    };
    setupDataSources(dataSources.default);
    setFolderResponse(mockFolder(folder));
  });

  describe('Grafana-managed rules', function () {
    it('should populate form values from the existing alert rule', async function () {
      render(
        <ExistingRuleEditor
          identifier={{ uid: grafanaRulerRule.grafana_alert.uid, ruleSourceName: 'grafana' }}
          clone={true}
        />,
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(within(ui.inputs.group.get()).queryByTestId('Spinner')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(ui.inputs.name.get()).toHaveValue(`${grafanaRulerRule.grafana_alert.title} (copy)`);
      });
      expect(ui.inputs.folderContainer.get()).toHaveTextContent('Folder A');
      expect(ui.inputs.group.get()).toHaveTextContent(grafanaRulerRule.grafana_alert.rule_group);
      expect(
        byRole('listitem', {
          name: 'severity: critical',
        }).get()
      ).toBeInTheDocument();
      expect(
        byRole('listitem', {
          name: 'region: nasa',
        }).get()
      ).toBeInTheDocument();
      expect(ui.inputs.annotationValue(0).get()).toHaveTextContent(grafanaRulerRule.annotations![Annotation.summary]);
    });
  });

  describe('Cloud rules', function () {
    it('should populate form values from the existing alert rule', async function () {
      const dsSettings = mockDataSource({
        name: 'my-prom-ds',
        uid: MIMIR_DATASOURCE_UID,
      });
      setupDataSources(dsSettings);

      const originRule = mockRulerAlertingRule({
        for: '1m',
        alert: 'First Ruler Rule',
        expr: 'vector(1) > 0',
        labels: { severity: 'critical', region: 'nasa' },
        annotations: { [Annotation.summary]: 'This is a very important alert rule' },
      });

      mockRulerRulesApiResponse(server, MIMIR_DATASOURCE_UID, {
        'namespace-one': [{ name: 'group1', interval: '20s', rules: [originRule] }],
      });

      mockRulerRulesGroupApiResponse(server, MIMIR_DATASOURCE_UID, 'namespace-one', 'group1', {
        name: 'group1',
        interval: '20s',
        rules: [originRule],
      });

      render(
        <ExistingRuleEditor
          identifier={{
            ruleSourceName: 'my-prom-ds',
            namespace: 'namespace-one',
            groupName: 'group1',
            ruleName: 'First Ruler Rule',
            rulerRuleHash: hashRulerRule(originRule),
          }}
          clone={true}
        />,
        { wrapper: Wrapper }
      );

      await waitFor(() => {
        expect(ui.inputs.name.get()).toHaveValue('First Ruler Rule (copy)');
      });
      expect(ui.inputs.expr.get()).toHaveValue('vector(1) > 0');
      expect(ui.inputs.namespace.get()).toHaveTextContent('namespace-one');
      expect(ui.inputs.group.get()).toHaveTextContent('group1');
      expect(
        byRole('listitem', {
          name: 'severity: critical',
        }).get()
      ).toBeInTheDocument();
      expect(
        byRole('listitem', {
          name: 'region: nasa',
        }).get()
      ).toBeInTheDocument();
      expect(ui.inputs.annotationValue(0).get()).toHaveTextContent('This is a very important alert rule');
    });
  });

  describe('cloneRuleDefinition', () => {
    it("Should change the cloned rule's name accordingly for Grafana rules", () => {
      const rule: RulerGrafanaRuleDTO = mockRulerGrafanaRule(
        {
          for: '1m',
          labels: { severity: 'critical', region: 'nasa' },
          annotations: { [Annotation.summary]: 'This is a very important alert rule' },
        },
        { uid: 'grafana-rule-1', title: 'First Grafana Rule', data: [] }
      );

      const originalRule: RuleWithLocation<RulerGrafanaRuleDTO> = {
        ruleSourceName: 'my-prom-ds',
        namespace: 'namespace-one',
        group: mockRulerRuleGroup(),
        rule,
      };

      const clonedRule: RuleWithLocation<RulerRuleDTO> = cloneRuleDefinition(originalRule);

      const grafanaRule: RulerGrafanaRuleDTO = clonedRule.rule as RulerGrafanaRuleDTO;

      expect(originalRule.rule.grafana_alert.title).toEqual('First Grafana Rule');
      expect(grafanaRule.grafana_alert.title).toEqual('First Grafana Rule (copy)');
    });

    it("Should change the cloned rule's name accordingly for Ruler rules", () => {
      const rule: RulerAlertingRuleDTO = mockRulerAlertingRule({
        for: '1m',
        alert: 'First Ruler Rule',
        expr: 'vector(1) > 0',
        labels: { severity: 'critical', region: 'nasa' },
        annotations: { [Annotation.summary]: 'This is a very important alert rule' },
      });

      const originalRule: RuleWithLocation<RulerAlertingRuleDTO> = {
        ruleSourceName: 'my-prom-ds',
        namespace: 'namespace-one',
        group: mockRulerRuleGroup(),
        rule,
      };

      const clonedRule: RuleWithLocation<RulerRuleDTO> = cloneRuleDefinition(originalRule);

      const alertingRule: RulerAlertingRuleDTO = clonedRule.rule as RulerAlertingRuleDTO;

      expect(originalRule.rule.alert).toEqual('First Ruler Rule');
      expect(alertingRule.alert).toEqual('First Ruler Rule (copy)');
    });

    it("Should change the cloned rule's name accordingly for Recording rules", () => {
      const rule: RulerRecordingRuleDTO = {
        record: 'instance:node_num_cpu:sum',
        expr: 'count without (cpu) (count without (mode) (node_cpu_seconds_total{job="integrations/node_exporter"}))',
        labels: { type: 'cpu' },
      };

      const originalRule: RuleWithLocation<RulerRecordingRuleDTO> = {
        ruleSourceName: 'my-prom-ds',
        namespace: 'namespace-one',
        group: mockRulerRuleGroup(),
        rule,
      };

      const clonedRule: RuleWithLocation<RulerRuleDTO> = cloneRuleDefinition(originalRule);

      const recordingRule: RulerRecordingRuleDTO = clonedRule.rule as RulerRecordingRuleDTO;

      expect(originalRule.rule.record).toEqual('instance:node_num_cpu:sum');
      expect(recordingRule.record).toEqual('instance:node_num_cpu:sum (copy)');
    });

    it('Should remove the group for provisioned Grafana rules', () => {
      const rule: RulerGrafanaRuleDTO = mockRulerGrafanaRule(
        {
          for: '1m',
          labels: { severity: 'critical', region: 'nasa' },
          annotations: { [Annotation.summary]: 'This is a very important alert rule' },
        },
        { uid: 'grafana-rule-1', title: 'First Grafana Rule', data: [], provenance: 'foo' }
      );

      const originalRule: RuleWithLocation<RulerGrafanaRuleDTO> = {
        ruleSourceName: 'my-prom-ds',
        namespace: 'namespace-one',
        group: mockRulerRuleGroup(),
        rule,
      };

      const clonedRule: RuleWithLocation<RulerRuleDTO> = cloneRuleDefinition(originalRule);

      expect(originalRule.group.name).toEqual('group1');
      expect(clonedRule.group.name).toEqual('');
    });

    it('The cloned rule should not contain a UID property', () => {
      const rule: RulerGrafanaRuleDTO = mockRulerGrafanaRule(
        {
          for: '1m',
          labels: { severity: 'critical', region: 'nasa' },
          annotations: { [Annotation.summary]: 'This is a very important alert rule' },
        },
        { uid: 'grafana-rule-1', title: 'First Grafana Rule', data: [] }
      );

      const originalRule: RuleWithLocation<RulerGrafanaRuleDTO> = {
        ruleSourceName: 'my-prom-ds',
        namespace: 'namespace-one',
        group: mockRulerRuleGroup(),
        rule,
      };

      const clonedRule: RuleWithLocation<RulerRuleDTO> = cloneRuleDefinition(originalRule);

      const grafanaRule: RulerGrafanaRuleDTO = clonedRule.rule as RulerGrafanaRuleDTO;

      expect(originalRule.rule.grafana_alert.uid).toEqual('grafana-rule-1');
      expect(grafanaRule.grafana_alert.uid).toEqual('');
    });
  });
});
