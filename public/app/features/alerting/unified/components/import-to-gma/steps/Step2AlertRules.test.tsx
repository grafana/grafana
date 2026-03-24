import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import React, { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, waitFor } from 'test/test-utils';

import { mockAlertRuleApi, setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions, mockDataSource } from 'app/features/alerting/unified/mocks';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';
import { SupportedRulesSourceType } from 'app/features/alerting/unified/utils/datasource';
import { AccessControlAction } from 'app/types/accessControl';
import { PromRulesResponse, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { ImportFormValues } from '../ImportToGMA';

import { Step2Content, useStep2Validation } from './Step2AlertRules';

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
  });

  describe('Step2Content rendering', () => {
    it('should render permission warning when canImport=false', () => {
      render(
        <TestWrapper>
          <Step2Content step1Completed={false} step1Skipped={false} canImport={false} />
        </TestWrapper>
      );

      expect(screen.getByText(/you do not have permission to import alert rules/i)).toBeInTheDocument();
      expect(screen.getByText(/insufficient permissions/i)).toBeInTheDocument();
    });

    it('should render "Step 1 was skipped" alert when step1Skipped=true', () => {
      render(
        <TestWrapper>
          <Step2Content step1Completed={false} step1Skipped={true} canImport={true} />
        </TestWrapper>
      );

      expect(screen.getByText(/step 1 was skipped/i)).toBeInTheDocument();
      expect(screen.getByText(/you skipped importing alertmanager resources/i)).toBeInTheDocument();
    });

    it('should render notification routing dropdown', () => {
      render(
        <TestWrapper>
          <Step2Content step1Completed={false} step1Skipped={false} canImport={true} />
        </TestWrapper>
      );

      expect(screen.getByText(/notification routing/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/select a policy tree/i)).toBeInTheDocument();
    });

    it('should render source selection and target settings', () => {
      render(
        <TestWrapper>
          <Step2Content step1Completed={false} step1Skipped={false} canImport={true} />
        </TestWrapper>
      );

      expect(screen.getByText(/import source/i)).toBeInTheDocument();
      expect(screen.getByText(/additional settings/i)).toBeInTheDocument();
      expect(screen.getByText(/target data source/i)).toBeInTheDocument();
    });

    it('should render datasource picker when datasource source is selected', () => {
      render(
        <TestWrapper defaultValues={{ rulesSource: 'datasource' }}>
          <Step2Content step1Completed={false} step1Skipped={false} canImport={true} />
        </TestWrapper>
      );

      const dataSourceInputs = screen.getAllByPlaceholderText(/select data source/i);
      expect(dataSourceInputs.length).toBeGreaterThan(0);
    });

    it('should render YAML file upload when YAML source is selected', () => {
      render(
        <TestWrapper defaultValues={{ rulesSource: 'yaml' }}>
          <Step2Content step1Completed={false} step1Skipped={false} canImport={true} />
        </TestWrapper>
      );

      expect(screen.getByTestId('data-testid-file-upload-input-field')).toBeInTheDocument();
    });

    it('should show YAML source option', () => {
      render(
        <TestWrapper>
          <Step2Content step1Completed={false} step1Skipped={false} canImport={true} />
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
            selectedRoutingTree: 'my-routing-tree',
            targetDatasourceUID: 'prometheus-uid',
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(true);
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
          <Step2Content step1Completed={false} step1Skipped={false} canImport={true} />
        </TestWrapper>
      );

      const uploadInput = screen.getByTestId('data-testid-file-upload-input-field');
      await userEvent.upload(uploadInput, invalidYaml);

      await waitFor(() => {
        expect(screen.getByText(/failed to parse yaml file/i)).toBeInTheDocument();
      });
    });

    it('should clear YAML file when switching from yaml to datasource source', async () => {
      const yamlFile = new File(['groups: []'], 'rules.yaml', { type: 'text/yaml' });

      render(
        <TestWrapper defaultValues={{ rulesSource: 'yaml', rulesYamlFile: yamlFile }}>
          <Step2Content step1Completed={false} step1Skipped={false} canImport={true} />
        </TestWrapper>
      );

      // Switch to datasource
      const datasourceRadio = screen.getByRole('radio', { name: /data source/i });
      await userEvent.click(datasourceRadio);

      // Switch back to yaml — file should be cleared
      const yamlRadio = screen.getByRole('radio', { name: /yaml file/i });
      await userEvent.click(yamlRadio);

      expect(screen.getByText(/upload yaml file/i)).toBeInTheDocument();
    });

    it('should not block validation when switching from yaml with error to datasource', async () => {
      const onResult = jest.fn();

      render(
        <TestWrapper defaultValues={{ rulesSource: 'yaml' }}>
          <Step2Content step1Completed={false} step1Skipped={false} canImport={true} />
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      // Upload an invalid file to trigger validation error
      const invalidYaml = new File(['not: valid: yaml: {{{'], 'invalid.yaml', { type: 'text/yaml' });
      const uploadInput = screen.getByTestId('data-testid-file-upload-input-field');
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
