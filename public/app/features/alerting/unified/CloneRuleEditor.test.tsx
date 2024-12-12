import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { getWrapper, render, waitFor, waitForElementToBeRemoved, within } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { setDataSourceSrv } from '@grafana/runtime';
import { RuleWithLocation } from 'app/types/unified-alerting';

import { AccessControlAction } from '../../../types';
import {
  RulerAlertingRuleDTO,
  RulerGrafanaRuleDTO,
  RulerRecordingRuleDTO,
  RulerRuleDTO,
} from '../../../types/unified-alerting-dto';

import { CloneRuleEditor, cloneRuleDefinition } from './CloneRuleEditor';
import { ExpressionEditorProps } from './components/rule-editor/ExpressionEditor';
import { mockFeatureDiscoveryApi, setupMswServer } from './mockApi';
import {
  MockDataSourceSrv,
  grantUserPermissions,
  mockDataSource,
  mockRulerAlertingRule,
  mockRulerGrafanaRule,
  mockRulerRuleGroup,
} from './mocks';
import { grafanaRulerRule } from './mocks/grafanaRulerApi';
import { mockRulerRulesApiResponse, mockRulerRulesGroupApiResponse } from './mocks/rulerApi';
import { AlertingQueryRunner } from './state/AlertingQueryRunner';
import { setupDataSources } from './testSetup/datasources';
import { buildInfoResponse } from './testSetup/featureDiscovery';
import { RuleFormValues } from './types/rule-form';
import { Annotation } from './utils/constants';
import { getDefaultFormValues } from './utils/rule-form';
import { hashRulerRule } from './utils/rule-id';

jest.mock('./components/rule-editor/ExpressionEditor', () => ({
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
  loadingIndicator: byText('Loading the rule...'),
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
  grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);

  describe('Grafana-managed rules', function () {
    it('should populate form values from the existing alert rule', async function () {
      setDataSourceSrv(new MockDataSourceSrv({}));

      render(
        <CloneRuleEditor sourceRuleId={{ uid: grafanaRulerRule.grafana_alert.uid, ruleSourceName: 'grafana' }} />,
        { wrapper: Wrapper }
      );

      await waitForElementToBeRemoved(ui.loadingIndicator.query());
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
      expect(ui.inputs.annotationValue(0).get()).toHaveTextContent(grafanaRulerRule.annotations[Annotation.summary]);
    });
  });

  describe('Cloud rules', function () {
    it('should populate form values from the existing alert rule', async function () {
      const dsSettings = mockDataSource({
        name: 'my-prom-ds',
        uid: 'my-prom-ds',
      });
      setupDataSources(dsSettings);
      mockFeatureDiscoveryApi(server).discoverDsFeatures(dsSettings, buildInfoResponse.mimir);
      const originRule = mockRulerAlertingRule({
        for: '1m',
        alert: 'First Ruler Rule',
        expr: 'vector(1) > 0',
        labels: { severity: 'critical', region: 'nasa' },
        annotations: { [Annotation.summary]: 'This is a very important alert rule' },
      });

      mockRulerRulesApiResponse(server, 'my-prom-ds', {
        'namespace-one': [{ name: 'group1', interval: '20s', rules: [originRule] }],
      });

      mockRulerRulesGroupApiResponse(server, 'my-prom-ds', 'namespace-one', 'group1', {
        name: 'group1',
        interval: '20s',
        rules: [originRule],
      });

      render(
        <CloneRuleEditor
          sourceRuleId={{
            ruleSourceName: 'my-prom-ds',
            namespace: 'namespace-one',
            groupName: 'group1',
            ruleName: 'First Ruler Rule',
            rulerRuleHash: hashRulerRule(originRule),
          }}
        />,
        { wrapper: Wrapper }
      );

      await waitForElementToBeRemoved(ui.loadingIndicator.query());

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
