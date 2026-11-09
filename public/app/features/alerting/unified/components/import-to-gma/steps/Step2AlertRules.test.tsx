import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import React, { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, waitFor } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';
import { mockBoundingClientRect } from '@grafana/test-utils';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import { CodeMirrorEditor, type CodeMirrorEditorProps } from '@grafana/ui/unstable';
import { mockAlertRuleApi, setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, mockDataSource } from 'app/features/alerting/unified/mocks';
import { alertingFactory } from 'app/features/alerting/unified/mocks/server/db';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import {
  failRecordingTargetDiscovery,
  holdRecordingTargetDiscovery,
} from 'app/features/alerting/unified/testSetup/recordingTargets';
import { type SupportedRulesSourceType } from 'app/features/alerting/unified/utils/datasource';
import { AccessControlAction } from 'app/types/accessControl';
import { type PromRulesResponse, type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { type ImportFormValues } from '../types';

import { Step2Content, useStep2Validation } from './Step2AlertRules';

jest.mock('@grafana/runtime/unstable', () => {
  const actual = jest.requireActual('@grafana/runtime/unstable');
  return { ...actual, useDataSourceInstanceList: jest.fn(actual.useDataSourceInstanceList) };
});

const runtime = jest.requireActual('@grafana/runtime/unstable');
const hookMock = jest.mocked(useDataSourceInstanceList);

const server = setupMswServer();

jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  CodeMirrorEditor: jest.fn(({ value, readOnly, 'aria-label': label }: CodeMirrorEditorProps) => (
    <textarea aria-label={label} value={value} readOnly={readOnly} />
  )),
}));

// Wrapper to provide react-hook-form context
function TestWrapper({
  children,
  defaultValues,
}: {
  children: React.ReactNode;
  defaultValues?: Partial<ImportFormValues>;
}) {
  const formAPI = useForm<ImportFormValues>({
    defaultValues: {
      step1Completed: false,
      step1Skipped: false,
      step2Completed: false,
      step2Skipped: false,
      policyTreeName: '',
      notificationsSource: 'yaml',
      notificationsDatasourceUID: undefined,
      notificationsDatasourceName: null,
      notificationsYamlFile: null,
      selectedRoutingTree: '',
      rulesSource: 'datasource',
      rulesDatasourceUID: undefined,
      rulesDatasourceName: null,
      rulesYamlFile: null,
      namespace: undefined,
      ruleGroup: undefined,
      targetFolder: undefined,
      pauseAlertingRules: true,
      pauseRecordingRules: true,
      targetDatasourceUID: undefined,
      ...defaultValues,
    },
  });
  return <FormProvider {...formAPI}>{children}</FormProvider>;
}

// Hook testing wrapper
function ValidationHookWrapper({ canImport, onResult }: { canImport: boolean; onResult: (result: boolean) => void }) {
  const isValid = useStep2Validation(canImport);
  useEffect(() => {
    onResult(isValid);
  }, [isValid, onResult]);
  return null;
}

const prometheusDataSource = mockDataSource({
  name: 'Prometheus',
  uid: 'prometheus-uid',
  type: 'prometheus' as SupportedRulesSourceType,
});

const lokiDataSource = mockDataSource({
  name: 'Loki',
  uid: 'loki-uid',
  type: 'loki' as SupportedRulesSourceType,
});

describe('Step2AlertRules', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(() => {
    mockBoundingClientRect();
  });

  beforeEach(() => {
    // useAsync from react-use triggers state updates outside act() when parsing YAML
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    setupDataSources(prometheusDataSource, lokiDataSource);
    grantUserPermissions([AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingProvisioningSetStatus]);

    // Mock API endpoints used by useGetNameSpacesByDatasourceName hook
    // The hook uses RTK Query which calls these HTTP endpoints
    const mockApi = mockAlertRuleApi(server);
    const emptyPromRulesResponse: PromRulesResponse = { status: 'success', data: { groups: [] } };
    const emptyRulerRulesResponse: RulerRulesConfigDTO = {};

    // Mock empty responses for Prometheus rules namespaces (used when datasource is selected)
    mockApi.prometheusRuleNamespaces('Prometheus', emptyPromRulesResponse);
    mockApi.prometheusRuleNamespaces('Loki', emptyPromRulesResponse);

    // Mock empty responses for Ruler rules (used when datasource is selected)
    mockApi.rulerRules('Prometheus', emptyRulerRulesResponse);
    mockApi.rulerRules('Loki', emptyRulerRulesResponse);

    // Mock discoverDsFeatures endpoint - returns Mimir-like features with ruler enabled
    // This is used by useDiscoverDsFeaturesQuery to determine datasource capabilities
    server.use(
      http.get('/api/datasources/proxy/:uid/api/v1/buildinfo', () =>
        HttpResponse.json({
          status: 'success',
          data: {
            version: '2.0.0',
            features: {
              ruler_config_api: 'true',
            },
          },
        })
      )
    );
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    hookMock.mockImplementation(runtime.useDataSourceInstanceList);
  });

  it('previews overwritten rules as read-only JSON when warning details are expanded', async () => {
    const rule = alertingFactory.ruler.grafana.alertingRule.build({ grafana_alert: { title: 'Existing alert' } });
    const group = alertingFactory.ruler.grafana.group.build({ name: 'existing-group', rules: [rule] });
    server.use(
      getCustomSearchHandler([
        {
          resource: 'folders',
          name: 'existing-folder',
          title: 'existing-namespace',
          folder: 'target-folder',
          field: {},
        },
      ]),
      http.get('/api/ruler/grafana/api/v1/rules/existing-folder', () =>
        HttpResponse.json({ 'existing-namespace': [group] })
      )
    );
    const user = userEvent.setup();
    render(
      <TestWrapper
        defaultValues={{
          rulesSource: 'yaml',
          rulesYamlFile: new File(
            [
              'namespace: existing-namespace\ngroups:\n  - name: incoming-group\n    rules:\n      - alert: Incoming alert\n        expr: up == 0\n',
            ],
            'existing-namespace.yaml',
            { type: 'application/yaml' }
          ),
          targetFolder: { uid: 'target-folder', title: 'Target folder' },
        }}
      >
        <Step2Content step1Completed={false} canImport={true} />
      </TestWrapper>
    );

    await user.click(await screen.findByText('Rules that might be overwritten'));

    expect(await screen.findByRole('textbox', { name: 'Rules that might be overwritten' })).toHaveAttribute('readonly');
    expect(jest.mocked(CodeMirrorEditor).mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        height: '300px',
        language: 'json',
        readOnly: true,
        value: expect.stringContaining('Existing alert'),
      })
    );
    expect(jest.mocked(CodeMirrorEditor).mock.lastCall?.[0].lineWrapping).toBeFalsy();
  });

  describe('recording rules target', () => {
    // The picker only lists data sources that declare a capability such as alerting.
    const prometheus = mockDataSource(
      { name: 'Prometheus', uid: 'prometheus-uid', type: 'prometheus' },
      { alerting: true }
    );
    const loki = mockDataSource({ name: 'Loki', uid: 'loki-uid', type: 'loki' }, { alerting: true });
    const optedOut = mockDataSource(
      { name: 'Opted out', uid: 'opted-out-uid', type: 'prometheus', jsonData: { allowAsRecordingRulesTarget: false } },
      { alerting: true }
    );

    beforeEach(() => {
      setupDataSources(prometheus, loki, optedOut);
    });

    function renderStep2() {
      const view = render(
        <TestWrapper defaultValues={{ rulesSource: 'datasource' }}>
          <Step2Content step1Completed={false} canImport={true} />
        </TestWrapper>
      );
      const [sourcePicker, targetPicker] = screen.getAllByTestId(selectors.components.DataSourcePicker.inputV2);
      return { ...view, sourcePicker, targetPicker };
    }

    it('disables the source and target pickers until the valid targets are known', async () => {
      const releaseDiscovery = holdRecordingTargetDiscovery(hookMock, runtime.useDataSourceInstanceList);
      const { sourcePicker, targetPicker } = renderStep2();

      expect(sourcePicker).toBeDisabled();
      expect(targetPicker).toBeDisabled();

      releaseDiscovery();

      await waitFor(() => expect(targetPicker).toBeEnabled());
      expect(sourcePicker).toBeEnabled();
    });

    it('fills the target with the selected source when the source accepts recording rules', async () => {
      const { user, sourcePicker, targetPicker } = renderStep2();
      await waitFor(() => expect(sourcePicker).toBeEnabled());

      await user.click(sourcePicker);
      await user.click(await screen.findByRole('option', { name: /Prometheus/ }));

      await waitFor(() => expect(targetPicker).toHaveAttribute('placeholder', 'Prometheus'));
    });

    it('offers only data sources that accept recording rules as targets', async () => {
      const { user, targetPicker } = renderStep2();
      await waitFor(() => expect(targetPicker).toBeEnabled());

      await user.click(targetPicker);

      expect(await screen.findByRole('option', { name: /Prometheus/ })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /Opted out/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /Loki/ })).not.toBeInTheDocument();
    });

    it('clears the target together with the source only while the target was filled in from it', async () => {
      const prometheus2 = mockDataSource(
        { name: 'Prometheus 2', uid: 'prometheus-2-uid', type: 'prometheus' },
        { alerting: true }
      );
      setupDataSources(prometheus, prometheus2);
      const { user, sourcePicker, targetPicker } = renderStep2();
      await waitFor(() => expect(sourcePicker).toBeEnabled());

      await user.click(sourcePicker);
      await user.click(await screen.findByRole('option', { name: /^Prometheus$/ }));
      await waitFor(() => expect(targetPicker).toHaveAttribute('placeholder', 'Prometheus'));

      await user.click(screen.getByRole('button', { name: /clear data source/i }));
      await waitFor(() => expect(targetPicker).toHaveAttribute('placeholder', 'Select data source'));

      await user.click(sourcePicker);
      await user.click(await screen.findByRole('option', { name: /^Prometheus$/ }));
      await user.click(targetPicker);
      await user.click(await screen.findByRole('option', { name: /Prometheus 2/ }));
      await waitFor(() => expect(targetPicker).toHaveAttribute('placeholder', 'Prometheus 2'));

      await user.click(screen.getByRole('button', { name: /clear data source/i }));
      await waitFor(() => expect(sourcePicker).toHaveAttribute('placeholder', 'Select data source'));
      expect(targetPicker).toHaveAttribute('placeholder', 'Prometheus 2');
    });

    it('shows an error on the target field when the valid targets cannot be loaded', async () => {
      failRecordingTargetDiscovery(hookMock);
      renderStep2();

      expect(
        await screen.findByText('Failed to load the list of data sources that can store recording rules')
      ).toBeInTheDocument();
    });
  });

  describe('namespace and group filter', () => {
    const prometheus = mockDataSource(
      { name: 'Prometheus', uid: 'prometheus-uid', type: 'prometheus' },
      { alerting: true }
    );
    const alertRule = (alert: string) => ({ alert, expr: 'up == 0' });

    beforeEach(() => {
      setupDataSources(prometheus);
      // Namespaces come from the data source's ruler API, once its features are discovered.
      grantUserPermissions([
        AccessControlAction.AlertingRuleCreate,
        AccessControlAction.AlertingProvisioningSetStatus,
        AccessControlAction.AlertingRuleExternalRead,
      ]);
      server.use(
        http.get('/api/datasources/proxy/uid/:uid/api/v1/status/buildinfo', () =>
          HttpResponse.json({ status: 'success', data: { version: '2.0.0', features: { ruler_config_api: 'true' } } })
        )
      );
      mockAlertRuleApi(server).rulerRules('prometheus-uid', {
        'ns-a': [
          { name: 'group-1', rules: [alertRule('A1')] },
          { name: 'group-2', rules: [alertRule('A2')] },
        ],
        'ns-b': [{ name: 'group-3', rules: [alertRule('B1')] }],
      });
    });

    async function pick(user: ReturnType<typeof render>['user'], testId: string, option: string) {
      await waitFor(() => expect(screen.getByTestId(testId)).toBeEnabled());
      await user.click(screen.getByTestId(testId));
      await user.click(await screen.findByRole('option', { name: option }));
    }

    it('clears the group when another namespace is picked', async () => {
      const { user } = render(
        <TestWrapper defaultValues={{ rulesDatasourceUID: 'prometheus-uid', rulesDatasourceName: 'Prometheus' }}>
          <Step2Content step1Completed={false} canImport={true} />
        </TestWrapper>
      );
      const { namespaceInput, groupInput } = selectors.pages.Alerting.ImportToGMA;

      await pick(user, namespaceInput, 'ns-a');
      await pick(user, groupInput, 'group-1');
      expect(screen.getByTestId(groupInput)).toHaveValue('group-1');

      await pick(user, namespaceInput, 'ns-b');

      expect(screen.getByTestId(groupInput)).toHaveValue('');
    });

    it('routes to the policy tree picked, including the one step 1 will create', async () => {
      const { user } = render(
        <TestWrapper defaultValues={{ policyTreeName: 'imported', step1Completed: true }}>
          <Step2Content step1Completed={true} canImport={true} />
        </TestWrapper>
      );
      const { policyTreeInput } = selectors.pages.Alerting.ImportToGMA;

      await pick(user, policyTreeInput, 'imported');

      expect(screen.getByTestId(policyTreeInput)).toHaveValue('imported');
    });
  });

  describe('data source for a YAML file', () => {
    const prometheus = mockDataSource(
      { name: 'Prometheus', uid: 'prometheus-uid', type: 'prometheus' },
      { alerting: true }
    );
    const prometheus2 = mockDataSource(
      { name: 'Prometheus 2', uid: 'prometheus-2-uid', type: 'prometheus' },
      { alerting: true }
    );
    const description = /will be queried by the imported rules/i;

    beforeEach(() => {
      setupDataSources(prometheus, prometheus2);
    });

    function renderYamlStep2(defaultValues: Partial<ImportFormValues> = {}) {
      const view = render(
        <TestWrapper defaultValues={{ rulesSource: 'yaml', ...defaultValues }}>
          <Step2Content step1Completed={false} canImport={true} />
        </TestWrapper>
      );
      const [yamlTargetPicker, recordingTargetPicker] = screen.getAllByTestId(
        selectors.components.DataSourcePicker.inputV2
      );
      return { ...view, yamlTargetPicker, recordingTargetPicker };
    }

    it('is asked for with a YAML file, and not with a data source', () => {
      const { unmount } = renderYamlStep2();
      expect(screen.getByText(description)).toBeInTheDocument();
      unmount();

      render(
        <TestWrapper defaultValues={{ rulesSource: 'datasource' }}>
          <Step2Content step1Completed={false} canImport={true} />
        </TestWrapper>
      );
      expect(screen.queryByText(description)).not.toBeInTheDocument();
    });

    it('fills the recording rules target from it while that is still empty', async () => {
      const { user, yamlTargetPicker, recordingTargetPicker } = renderYamlStep2();
      await waitFor(() => expect(yamlTargetPicker).toBeEnabled());

      await user.click(yamlTargetPicker);
      await user.click(await screen.findByRole('option', { name: /^Prometheus$/ }));

      await waitFor(() => expect(recordingTargetPicker).toHaveAttribute('placeholder', 'Prometheus'));
    });

    it('keeps a recording rules target that was already picked', async () => {
      const { user, yamlTargetPicker, recordingTargetPicker } = renderYamlStep2({
        targetDatasourceUID: 'prometheus-2-uid',
      });
      await waitFor(() => expect(yamlTargetPicker).toBeEnabled());

      await user.click(yamlTargetPicker);
      await user.click(await screen.findByRole('option', { name: /^Prometheus$/ }));

      await waitFor(() => expect(yamlTargetPicker).toHaveAttribute('placeholder', 'Prometheus'));
      expect(recordingTargetPicker).toHaveAttribute('placeholder', 'Prometheus 2');
    });
  });

  describe('Step2Content rendering', () => {
    it('should render permission warning when canImport=false', () => {
      render(
        <TestWrapper>
          <Step2Content step1Completed={false} canImport={false} />
        </TestWrapper>
      );

      expect(screen.getByText(/you do not have permission to import alert rules/i)).toBeInTheDocument();
      expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
    });

    it('should render notification routing dropdown', () => {
      render(
        <TestWrapper>
          <Step2Content step1Completed={false} canImport={true} />
        </TestWrapper>
      );

      expect(screen.getByText(/notification routing/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/select a policy tree/i)).toBeInTheDocument();
    });

    it('offers the policy tree named in Step 1 first, even though the API does not know it yet', async () => {
      const { user } = render(
        <TestWrapper defaultValues={{ policyTreeName: 'brand-new-tree' }}>
          <Step2Content step1Completed={true} canImport={true} />
        </TestWrapper>
      );

      await user.click(screen.getByPlaceholderText(/select a policy tree/i));

      // The Step 1 option renders at once; the API's trees arrive later.
      await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(1));
      expect(screen.getAllByRole('option')[0]).toHaveTextContent('brand-new-tree');
    });

    it('should render source selection and target settings', () => {
      render(
        <TestWrapper>
          <Step2Content step1Completed={false} canImport={true} />
        </TestWrapper>
      );

      expect(screen.getByText(/import source/i)).toBeInTheDocument();
      expect(screen.getByText(/additional settings/i)).toBeInTheDocument();
      expect(screen.getByText(/target data source/i)).toBeInTheDocument();
    });

    it('should render datasource picker when datasource source is selected', () => {
      render(
        <TestWrapper defaultValues={{ rulesSource: 'datasource' }}>
          <Step2Content step1Completed={false} canImport={true} />
        </TestWrapper>
      );

      const dataSourceInputs = screen.getAllByPlaceholderText(/select data source/i);
      expect(dataSourceInputs.length).toBeGreaterThan(0);
    });

    it('should render YAML file upload when YAML source is selected', async () => {
      render(
        <TestWrapper defaultValues={{ rulesSource: 'yaml' }}>
          <Step2Content step1Completed={false} canImport={true} />
        </TestWrapper>
      );

      // FileDropzone is lazy-loaded, so wait for it to mount.
      expect(await screen.findByText(/drop yaml file here or click to upload/i)).toBeInTheDocument();
    });

    it('should show YAML source option', () => {
      render(
        <TestWrapper>
          <Step2Content step1Completed={false} canImport={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('radio', { name: /yaml file/i })).toBeInTheDocument();
      expect(screen.getByText(/import from a prometheus rules yaml file/i)).toBeInTheDocument();
    });
  });

  describe('useStep2Validation hook', () => {
    it('should return false when canImport=false', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper>
          <ValidationHookWrapper canImport={false} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return false when no datasource/file selected (datasource source)', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper defaultValues={{ rulesSource: 'datasource', rulesDatasourceUID: undefined }}>
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return false when no datasource/file selected (yaml source)', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper defaultValues={{ rulesSource: 'yaml', rulesYamlFile: null }}>
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return false when no routing tree selected', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            rulesSource: 'datasource',
            rulesDatasourceUID: 'prometheus-uid',
            selectedRoutingTree: '',
            targetDatasourceUID: 'prometheus-uid',
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return false when no target datasource', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            rulesSource: 'datasource',
            rulesDatasourceUID: 'prometheus-uid',
            selectedRoutingTree: '',
            targetDatasourceUID: undefined,
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return true when all required fields are filled (datasource source)', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            rulesSource: 'datasource',
            rulesDatasourceUID: 'prometheus-uid',
            selectedRoutingTree: 'my-routing-tree',
            targetDatasourceUID: 'prometheus-uid',
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(true);
    });

    it('should return true when all required fields are filled (yaml source)', () => {
      const mockFile = new File(['test'], 'test.yaml', { type: 'text/yaml' });
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            rulesSource: 'yaml',
            rulesYamlFile: mockFile,
            yamlImportTargetDatasourceUID: 'prometheus-uid',
            selectedRoutingTree: 'my-routing-tree',
            targetDatasourceUID: 'prometheus-uid',
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(true);
    });

    it('should return false for a YAML file without a data source to run its rules against', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            rulesSource: 'yaml',
            rulesYamlFile: new File(['test'], 'test.yaml', { type: 'text/yaml' }),
            selectedRoutingTree: 'my-routing-tree',
            targetDatasourceUID: 'prometheus-uid',
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).not.toHaveBeenCalledWith(true);
    });

    it('should return true when all required fields are filled (with policyTreeName from Step 1)', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            rulesSource: 'datasource',
            rulesDatasourceUID: 'prometheus-uid',
            selectedRoutingTree: 'test-policy',
            policyTreeName: 'test-policy',
            targetDatasourceUID: 'prometheus-uid',
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(true);
    });
  });

  describe('YAML validation and source switching', () => {
    it('should show validation error immediately when uploading an invalid YAML file', async () => {
      const invalidYaml = new File(['not: valid: yaml: {{{'], 'invalid.yaml', { type: 'text/yaml' });

      render(
        <TestWrapper defaultValues={{ rulesSource: 'yaml' }}>
          <Step2Content step1Completed={false} canImport={true} />
        </TestWrapper>
      );

      const uploadInput = await screen.findByLabelText(/^rules yaml file/i);
      await userEvent.upload(uploadInput, invalidYaml);

      await waitFor(() => {
        expect(screen.getByText(/failed to parse yaml file/i)).toBeInTheDocument();
      });
    });

    it('shows the parse error for an invalid file, and drops it for a valid file or once the file is removed', async () => {
      const { user } = render(
        <TestWrapper defaultValues={{ rulesSource: 'yaml' }}>
          <Step2Content step1Completed={false} canImport={true} />
        </TestWrapper>
      );

      const uploadInput = await screen.findByLabelText(/^rules yaml file/i);
      await user.upload(uploadInput, new File(['not: valid: yaml: {{{'], 'invalid.yaml', { type: 'text/yaml' }));
      expect(await screen.findByText(/failed to parse yaml file/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /remove invalid\.yaml/i }));
      await waitFor(() => expect(screen.queryByText(/failed to parse yaml file/i)).not.toBeInTheDocument());

      await user.upload(
        await screen.findByLabelText(/^rules yaml file/i),
        new File(['groups:\n  - name: g\n    rules:\n      - alert: A\n        expr: up == 0\n'], 'valid.yaml', {
          type: 'text/yaml',
        })
      );
      expect(await screen.findByText('valid.yaml')).toBeInTheDocument();
      expect(screen.queryByText(/failed to parse yaml file/i)).not.toBeInTheDocument();
    });

    it.each([
      ['has no groups', 'groups: []'],
      ['has groups without rules', 'groups:\n  - name: empty\n    rules: []\n'],
    ])('rejects a file that %s, since importing it would do nothing', async (_, content) => {
      const { user } = render(
        <TestWrapper defaultValues={{ rulesSource: 'yaml' }}>
          <Step2Content step1Completed={false} canImport={true} />
        </TestWrapper>
      );

      await user.upload(
        await screen.findByLabelText(/^rules yaml file/i),
        new File([content], 'empty.yaml', { type: 'text/yaml' })
      );

      expect(await screen.findByText(/no rules found in this file/i)).toBeInTheDocument();
    });

    it.each([
      ['cannot be parsed', 'groups: [not: valid', /failed to parse yaml file/i],
      ['has no rules', 'groups: []', /no rules found in this file/i],
    ])('does not let the step continue while a file that %s is chosen', async (_, content, message) => {
      const onResult = jest.fn();
      const { user } = render(
        <TestWrapper
          defaultValues={{
            rulesSource: 'yaml',
            yamlImportTargetDatasourceUID: 'prometheus-uid',
            selectedRoutingTree: 'my-routing-tree',
            targetDatasourceUID: 'prometheus-uid',
          }}
        >
          <Step2Content step1Completed={false} canImport={true} />
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      await user.upload(
        await screen.findByLabelText(/^rules yaml file/i),
        new File([content], 'rules.yaml', { type: 'text/yaml' })
      );

      expect(await screen.findByText(message)).toBeInTheDocument();
      await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(false));
    });

    it('should clear YAML file when switching from yaml to datasource source', async () => {
      const yamlFile = new File(
        ['groups:\n  - name: g\n    rules:\n      - alert: A\n        expr: up == 0\n'],
        'rules.yaml',
        { type: 'text/yaml' }
      );

      render(
        <TestWrapper defaultValues={{ rulesSource: 'yaml', rulesYamlFile: yamlFile }}>
          <Step2Content step1Completed={false} canImport={true} />
        </TestWrapper>
      );

      // Switch to datasource
      const datasourceRadio = screen.getByRole('radio', { name: /data source/i });
      await userEvent.click(datasourceRadio);

      // Switch back to yaml — file should be cleared
      const yamlRadio = screen.getByRole('radio', { name: /yaml file/i });
      await userEvent.click(yamlRadio);

      expect(await screen.findByText(/drop yaml file here or click to upload/i)).toBeInTheDocument();
      expect(screen.queryByText('rules.yaml')).not.toBeInTheDocument();
    });

    it('should not block validation when switching from yaml with error to datasource', async () => {
      const onResult = jest.fn();

      render(
        <TestWrapper defaultValues={{ rulesSource: 'yaml' }}>
          <Step2Content step1Completed={false} canImport={true} />
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      // Upload an invalid file to trigger validation error
      const invalidYaml = new File(['not: valid: yaml: {{{'], 'invalid.yaml', { type: 'text/yaml' });
      const uploadInput = await screen.findByLabelText(/^rules yaml file/i);
      await userEvent.upload(uploadInput, invalidYaml);

      await waitFor(() => {
        expect(screen.getByText(/failed to parse yaml file/i)).toBeInTheDocument();
      });

      // Switch to datasource — error should be cleared and not block validation
      const datasourceRadio = screen.getByRole('radio', { name: /data source/i });
      await userEvent.click(datasourceRadio);

      await waitFor(() => {
        expect(screen.queryByText(/failed to parse yaml file/i)).not.toBeInTheDocument();
      });
    });
  });
});
