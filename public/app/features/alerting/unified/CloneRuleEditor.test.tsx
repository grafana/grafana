import { render, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { setupServer } from 'msw/node';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { TestProvider } from 'test/helpers/TestProvider';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { selectors } from '@grafana/e2e-selectors/src';
import { config, setBackendSrv, setDataSourceSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import 'whatwg-fetch';

import { RulerGrafanaRuleDTO } from '../../../types/unified-alerting-dto';

import { CloneRuleEditor } from './CloneRuleEditor';
import { ExpressionEditorProps } from './components/rule-editor/ExpressionEditor';
import { mockDataSource, MockDataSourceSrv, mockRulerAlertingRule, mockRulerGrafanaRule, mockStore } from './mocks';
import { mockSearchApiResponse } from './mocks/grafanaApi';
import { mockRulerRulesApiResponse, mockRulerRulesGroupApiResponse } from './mocks/rulerApi';
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
  loadingGroupIndicator: byText('Loading...'),
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

      render(<CloneRuleEditor sourceRuleId={{ uid: 'grafana-rule-1', ruleSourceName: 'grafana' }} />, {
        wrapper: getProvidersWrapper(),
      });

      await waitForElementToBeRemoved(ui.loadingIndicator.query());
      await waitForElementToBeRemoved(ui.loadingGroupIndicator.query(), { container: ui.inputs.group.get() });

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
});
