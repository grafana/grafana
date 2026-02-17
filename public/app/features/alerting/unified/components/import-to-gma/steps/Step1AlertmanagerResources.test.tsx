import userEvent from '@testing-library/user-event';
import React, { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { SupportedRulesSourceType } from 'app/features/alerting/unified/utils/datasource';
import { AlertManagerDataSourceJsonData, AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types/accessControl';

import { ImportFormValues } from '../ImportToGMA';

import { Step1Content, useStep1Validation } from './Step1AlertmanagerResources';

setupMswServer();

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
};

describe('Step1AlertmanagerResources', () => {
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
