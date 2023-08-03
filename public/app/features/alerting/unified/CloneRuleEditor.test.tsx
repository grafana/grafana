import { render, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { TestProvider } from 'test/helpers/TestProvider';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { selectors } from '@grafana/e2e-selectors/src';
import { config, setBackendSrv, setDataSourceSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import 'whatwg-fetch';
import { RuleWithLocation } from 'app/types/unified-alerting';

import {
  RulerAlertingRuleDTO,
  RulerGrafanaRuleDTO,
  RulerRecordingRuleDTO,
  RulerRuleDTO,
} from '../../../types/unified-alerting-dto';

import { cloneRuleDefinition, CloneRuleEditor } from './CloneRuleEditor';
import { ExpressionEditorProps } from './components/rule-editor/ExpressionEditor';
import {
  mockDataSource,
  MockDataSourceSrv,
  mockRulerAlertingRule,
  mockRulerGrafanaRule,
  mockRulerRuleGroup,
  mockStore,
} from './mocks';
import { mockAlertmanagerConfigResponse } from './mocks/alertmanagerApi';
import { mockSearchApiResponse } from './mocks/grafanaApi';
import { mockRulerRulesApiResponse, mockRulerRulesGroupApiResponse } from './mocks/rulerApi';
import { RuleFormValues } from './types/rule-form';
import { Annotation } from './utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { getDefaultFormValues } from './utils/rule-form';
import { hashRulerRule } from './utils/rule-id';

jest.mock('./components/rule-editor/ExpressionEditor', () => ({
  // eslint-disable-next-line react/display-name
  ExpressionEditor: ({ value, onChange }: ExpressionEditorProps) => (
    <input value={value} data-testid="expr" onChange={(e) => onChange(e.target.value)} />
  ),
}));

// For simplicity of the test we mock the NotificationPreview component
// Otherwise we would need to mock a few more HTTP api calls which are not relevant for these tests
jest.mock('./components/rule-editor/notificaton-preview/NotificationPreview', () => ({
  NotificationPreview: () => <div />,
}));

const server = setupServer();

beforeAll(() => {
  setBackendSrv(backendSrv);
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

const ui = {
  inputs: {
    name: byRole('textbox', { name: /rule name name for the alert rule\./i }),
    expr: byTestId('expr'),
    folderContainer: byTestId(selectors.components.FolderPicker.containerV2),
    namespace: byTestId('namespace-picker'),
    group: byTestId('group-picker'),
    annotationValue: (idx: number) => byTestId(`annotation-value-${idx}`),
    labelValue: (idx: number) => byTestId(`label-value-${idx}`),
  },
  loadingIndicator: byText('Loading the rule'),
};

function getProvidersWrapper() {
  return function Wrapper({ children }: React.PropsWithChildren<{}>) {
    const store = mockStore((store) => {
      store.unifiedAlerting.dataSources['grafana'] = {
        loading: false,
        dispatched: true,
        result: {
          id: 'grafana',
          name: 'grafana',
          rulerConfig: {
            dataSourceName: 'grafana',
            apiVersion: 'legacy',
          },
        },
      };
      store.unifiedAlerting.dataSources['my-prom-ds'] = {
        loading: false,
        dispatched: true,
        result: {
          id: 'my-prom-ds',
          name: 'my-prom-ds',
          rulerConfig: {
            dataSourceName: 'my-prom-ds',
            apiVersion: 'config',
          },
        },
      };
    });

    const formApi = useForm<RuleFormValues>({ defaultValues: getDefaultFormValues() });

    return (
      <TestProvider store={store}>
        <FormProvider {...formApi}>{children}</FormProvider>
      </TestProvider>
    );
  };
}

const amConfig: AlertManagerCortexConfig = {
  alertmanager_config: {
    receivers: [{ name: 'default' }, { name: 'critical' }],
    route: {
      receiver: 'default',
      group_by: ['alertname'],
      routes: [
        {
          matchers: ['env=prod', 'region!=EU'],
        },
      ],
    },
    templates: [],
  },
  template_files: {},
};

describe('CloneRuleEditor', function () {
  describe('Grafana-managed rules', function () {
    it('should populate form values from the existing alert rule', async function () {
      setDataSourceSrv(new MockDataSourceSrv({}));

      const originRule: RulerGrafanaRuleDTO = mockRulerGrafanaRule(
        {
          for: '1m',
          labels: { severity: 'critical', region: 'nasa' },
          annotations: { [Annotation.summary]: 'This is a very important alert rule' },
        },
        { uid: 'grafana-rule-1', title: 'First Grafana Rule', data: [] }
      );

      mockRulerRulesApiResponse(server, 'grafana', {
        'folder-one': [{ name: 'group1', interval: '20s', rules: [originRule] }],
      });

      mockSearchApiResponse(server, []);
      mockAlertmanagerConfigResponse(server, GRAFANA_RULES_SOURCE_NAME, amConfig);

      render(<CloneRuleEditor sourceRuleId={{ uid: 'grafana-rule-1', ruleSourceName: 'grafana' }} />, {
        wrapper: getProvidersWrapper(),
      });

      await waitForElementToBeRemoved(ui.loadingIndicator.query());
      await waitForElementToBeRemoved(within(ui.inputs.group.get()).getByTestId('Spinner'));

      await waitFor(() => {
        expect(ui.inputs.name.get()).toHaveValue('First Grafana Rule (copy)');
        expect(ui.inputs.folderContainer.get()).toHaveTextContent('folder-one');
        expect(ui.inputs.group.get()).toHaveTextContent('group1');
        expect(ui.inputs.labelValue(0).get()).toHaveTextContent('critical');
        expect(ui.inputs.labelValue(1).get()).toHaveTextContent('nasa');
        expect(ui.inputs.annotationValue(0).get()).toHaveTextContent('This is a very important alert rule');
      });
    });
  });

  describe('Cloud rules', function () {
    it('should populate form values from the existing alert rule', async function () {
      const dsSettings = mockDataSource({
        name: 'my-prom-ds',
        uid: 'my-prom-ds',
      });
      config.datasources = {
        'my-prom-ds': dsSettings,
      };

      setDataSourceSrv(new MockDataSourceSrv({ 'my-prom-ds': dsSettings }));

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

      mockSearchApiResponse(server, []);
      mockAlertmanagerConfigResponse(server, GRAFANA_RULES_SOURCE_NAME, amConfig);

      render(
        <CloneRuleEditor
          sourceRuleId={{
            uid: 'prom-rule-1',
            ruleSourceName: 'my-prom-ds',
            namespace: 'namespace-one',
            groupName: 'group1',
            rulerRuleHash: hashRulerRule(originRule),
          }}
        />,
        {
          wrapper: getProvidersWrapper(),
        }
      );

      await waitForElementToBeRemoved(ui.loadingIndicator.query());

      await waitFor(() => {
        expect(ui.inputs.name.get()).toHaveValue('First Ruler Rule (copy)');
        expect(ui.inputs.expr.get()).toHaveValue('vector(1) > 0');
        expect(ui.inputs.namespace.get()).toHaveTextContent('namespace-one');
        expect(ui.inputs.group.get()).toHaveTextContent('group1');
        expect(ui.inputs.labelValue(0).get()).toHaveTextContent('critical');
        expect(ui.inputs.labelValue(1).get()).toHaveTextContent('nasa');
        expect(ui.inputs.annotationValue(0).get()).toHaveTextContent('This is a very important alert rule');
      });
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
