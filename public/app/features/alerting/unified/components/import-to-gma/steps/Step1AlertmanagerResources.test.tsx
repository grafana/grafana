import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import React, { useCallback, useEffect } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { act, render, screen, waitFor } from 'test/test-utils';

import { mockBoundingClientRect } from '@grafana/test-utils';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { type SupportedRulesSourceType } from 'app/features/alerting/unified/utils/datasource';
import {
  type AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { type ImportFormValues } from '../ImportToGMA';
import { useDryRunNotifications } from '../useImport';

import { Step1Content, useStep1Validation } from './Step1AlertmanagerResources';

const server = setupMswServer();

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
      notificationsTemplateFiles: [],
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
  const isValid = useStep1Validation(canImport);
  useEffect(() => {
    onResult(isValid);
  }, [isValid, onResult]);
  return null;
}

const alertmanagerDataSource = mockDataSource<AlertManagerDataSourceJsonData>({
  name: 'Alertmanager',
  uid: 'alertmanager-uid',
  type: 'alertmanager' as SupportedRulesSourceType,
  jsonData: {
    implementation: AlertManagerImplementation.prometheus,
    handleGrafanaManagedAlerts: true,
  },
});

const defaultStep1Props = {
  canImport: true,
  dryRunState: 'idle' as const,
  onTriggerDryRun: jest.fn(),
  onResetDryRun: jest.fn(),
};

// Wires the real dry-run hook into Step1Content the way ImportWizardContent does, so the trigger
// effect runs against the real callbacks — used to guard against a re-trigger request loop.
function DryRunLoopHarness() {
  const { runDryRun, reset } = useDryRunNotifications();
  const { getValues } = useFormContext<ImportFormValues>();
  const onTriggerDryRun = useCallback(() => {
    const values = getValues();
    runDryRun({
      source: values.notificationsSource,
      datasourceName: values.notificationsDatasourceName ?? undefined,
      yamlFile: values.notificationsYamlFile,
      templateFiles: values.notificationsTemplateFiles,
      configIdentifier: values.policyTreeName,
    });
  }, [getValues, runDryRun]);

  return <Step1Content canImport dryRunState="idle" onTriggerDryRun={onTriggerDryRun} onResetDryRun={reset} />;
}

describe('Step1AlertmanagerResources', () => {
  beforeAll(() => {
    mockBoundingClientRect();
  });

  beforeEach(() => {
    setupDataSources(alertmanagerDataSource);
    grantUserPermissions([AccessControlAction.AlertingNotificationsWrite]);
  });

  describe('Step1Content rendering', () => {
    it('should render permission warning when canImport=false', () => {
      render(
        <TestWrapper>
          <Step1Content {...defaultStep1Props} canImport={false} />
        </TestWrapper>
      );

      expect(screen.getByText(/you do not have permission to import notification resources/i)).toBeInTheDocument();
      expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
    });

    it('should render Policy Tree Name field', () => {
      render(
        <TestWrapper>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      expect(screen.getByRole('heading', { name: /policy tree name/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/prometheus-prod/i)).toBeInTheDocument();
    });

    it('should render source selection (YAML/datasource)', () => {
      render(
        <TestWrapper>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      expect(screen.getByText(/import source/i)).toBeInTheDocument();

      const yamlRadio = screen.getByRole('radio', { name: /import from an alertmanager configuration yaml file/i });
      const datasourceRadio = screen.getByRole('radio', { name: /import from an alertmanager data source/i });

      expect(yamlRadio).toBeInTheDocument();
      expect(datasourceRadio).toBeInTheDocument();
      expect(yamlRadio).toBeChecked();
      expect(datasourceRadio).not.toBeChecked();
    });

    it('should render YAML file upload field when YAML source selected', () => {
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'yaml' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      expect(screen.getByText(/alertmanager config yaml/i)).toBeInTheDocument();
      expect(screen.getByText(/upload yaml file/i)).toBeInTheDocument();
    });

    it('should render datasource picker when datasource source selected', () => {
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'datasource' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      const alertmanagerDataSourceLabels = screen.getAllByText(/alertmanager data source/i);

      expect(alertmanagerDataSourceLabels.length).toBeGreaterThan(0);
      expect(screen.getByText(/select data source/i)).toBeInTheDocument();
    });

    it('should render the notification templates uploader for the YAML source', () => {
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'yaml' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      expect(screen.getByText(/notification templates/i)).toBeInTheDocument();
      expect(screen.getByText(/drop template files here or click to upload/i)).toBeInTheDocument();
    });

    it('should NOT render the templates uploader for the datasource source', () => {
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'datasource' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      expect(screen.queryByText(/drop template files here or click to upload/i)).not.toBeInTheDocument();
    });

    it('should list uploaded template files and show a duplicate-name error', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'yaml' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      // The dropzone's file input inherits the Field id, so its label resolves to it
      const input = screen.getByLabelText(/notification templates/i);

      await user.upload(input, [
        new File(['a'], 'dupe.tmpl', { type: 'text/plain' }),
        new File(['b'], 'dupe.tmpl', { type: 'text/plain' }),
      ]);

      expect(await screen.findByText(/duplicate template file name: "dupe.tmpl"/i)).toBeInTheDocument();
    });

    it('displays template files already present in form state (persists across navigation)', () => {
      render(
        <TestWrapper
          defaultValues={{
            notificationsSource: 'yaml',
            notificationsTemplateFiles: [
              new File(['a'], 'email.tmpl', { type: 'text/plain' }),
              new File(['b'], 'slack.tmpl', { type: 'text/plain' }),
            ],
          }}
        >
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      expect(screen.getByText('email.tmpl')).toBeInTheDocument();
      expect(screen.getByText('slack.tmpl')).toBeInTheDocument();
    });

    it('removes a template file when its remove button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper
          defaultValues={{
            notificationsSource: 'yaml',
            notificationsTemplateFiles: [
              new File(['a'], 'email.tmpl', { type: 'text/plain' }),
              new File(['b'], 'slack.tmpl', { type: 'text/plain' }),
            ],
          }}
        >
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      await user.click(screen.getByRole('button', { name: /remove email\.tmpl/i }));

      expect(screen.queryByText('email.tmpl')).not.toBeInTheDocument();
      expect(screen.getByText('slack.tmpl')).toBeInTheDocument();
    });
  });

  describe('useStep1Validation hook', () => {
    it('should return false when canImport=false', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper>
          <ValidationHookWrapper canImport={false} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return false when policyTreeName is empty', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper defaultValues={{ policyTreeName: '', notificationsSource: 'yaml' }}>
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return false when YAML source selected but no file', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            policyTreeName: 'test-policy',
            notificationsSource: 'yaml',
            notificationsYamlFile: null,
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return false when datasource source selected but no UID', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            policyTreeName: 'test-policy',
            notificationsSource: 'datasource',
            notificationsDatasourceUID: undefined,
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return false when policyTreeName is set but invalid', () => {
      const mockFile = new File(['test'], 'test.yaml', { type: 'text/yaml' });
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            policyTreeName: 'Invalid Name!',
            notificationsSource: 'yaml',
            notificationsYamlFile: mockFile,
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return true when all required fields are filled (YAML source)', () => {
      const mockFile = new File(['test'], 'test.yaml', { type: 'text/yaml' });
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            policyTreeName: 'test-policy',
            notificationsSource: 'yaml',
            notificationsYamlFile: mockFile,
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(true);
    });

    it('should return true when all required fields are filled (datasource source)', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            policyTreeName: 'test-policy',
            notificationsSource: 'datasource',
            notificationsDatasourceUID: 'alertmanager-uid',
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(true);
    });
  });

  describe('dry-run trigger effect', () => {
    it('triggers the dry-run once for a stable valid config and does not loop', async () => {
      let dryRunCount = 0;
      server.use(
        http.post('/api/convert/api/v1/alerts', () => {
          dryRunCount += 1;
          return HttpResponse.json({ status: 'success' });
        })
      );

      render(
        <TestWrapper
          defaultValues={{
            policyTreeName: 'prometheus-prod',
            notificationsSource: 'yaml',
            notificationsYamlFile: new File(['route:\n  receiver: default\n'], 'am.yaml', {
              type: 'application/yaml',
            }),
          }}
        >
          <DryRunLoopHarness />
        </TestWrapper>
      );

      await waitFor(() => expect(dryRunCount).toBeGreaterThanOrEqual(1));
      const settledCount = dryRunCount;
      // A single trigger (allow 2 for a StrictMode double-mount) — not a runaway loop.
      expect(settledCount).toBeLessThanOrEqual(2);
      // Give any runaway re-trigger loop time to fire more requests, then confirm it stopped.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 250));
      });
      expect(dryRunCount).toBe(settledCount);
    });
  });

  describe('AlertmanagerDataSourceSelect auto-population', () => {
    it('should auto-populate policyTreeName when datasource is selected and field is empty', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'datasource', policyTreeName: '' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      // Open the datasource select and choose the alertmanager
      const select = screen.getByRole('combobox');
      await user.click(select);
      await user.click(screen.getByText('Alertmanager'));

      // Verify the policy tree name field is populated with sanitized datasource name
      const policyTreeInput = screen.getByPlaceholderText(/prometheus-prod/i);
      expect(policyTreeInput).toHaveValue('alertmanager');
    });

    it('should NOT overwrite policyTreeName when datasource is selected and field has a value', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'datasource', policyTreeName: 'my-custom-name' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      const select = screen.getByRole('combobox');
      await user.click(select);
      await user.click(screen.getByText('Alertmanager'));

      // Verify the policy tree name field is NOT changed
      const policyTreeInput = screen.getByPlaceholderText(/prometheus-prod/i);
      expect(policyTreeInput).toHaveValue('my-custom-name');
    });

    it('should convert datasource name with special characters to kebab-case', async () => {
      // Setup a datasource with special characters in name
      setupDataSources(
        mockDataSource<AlertManagerDataSourceJsonData>({
          name: 'My Alertmanager (Production)',
          uid: 'am-prod-uid',
          type: 'alertmanager' as SupportedRulesSourceType,
          jsonData: {
            implementation: AlertManagerImplementation.prometheus,
            handleGrafanaManagedAlerts: true,
          },
        })
      );

      const user = userEvent.setup();
      render(
        <TestWrapper defaultValues={{ notificationsSource: 'datasource', policyTreeName: '' }}>
          <Step1Content {...defaultStep1Props} />
        </TestWrapper>
      );

      const select = screen.getByRole('combobox');
      await user.click(select);
      await user.click(screen.getByText('My Alertmanager (Production)'));

      const policyTreeInput = screen.getByPlaceholderText(/prometheus-prod/i);
      expect(policyTreeInput).toHaveValue('my-alertmanager-production');
    });
  });
});
