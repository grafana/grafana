import { HttpResponse, http } from 'msw';
import React, { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, userEvent } from 'test/test-utils';

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
      notificationPolicyOption: 'default',
      manualLabelName: '',
      manualLabelValue: '',
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
  beforeEach(() => {
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

    it('should render notification routing options', () => {
      render(
        <TestWrapper>
          <Step2Content step1Completed={false} step1Skipped={false} canImport={true} />
        </TestWrapper>
      );

      expect(screen.getByText(/notification routing/i)).toBeInTheDocument();
      expect(screen.getByText(/use grafana default policy/i)).toBeInTheDocument();
      expect(screen.getByText(/enter label manually/i)).toBeInTheDocument();
    });

    it('should show "imported policy" option only when step1Completed=true', () => {
      const { rerender } = render(
        <TestWrapper defaultValues={{ policyTreeName: 'test-policy' }}>
          <Step2Content step1Completed={false} step1Skipped={false} canImport={true} />
        </TestWrapper>
      );

      expect(screen.queryByText(/use imported policy/i)).not.toBeInTheDocument();

      rerender(
        <TestWrapper defaultValues={{ policyTreeName: 'test-policy' }}>
          <Step2Content step1Completed={true} step1Skipped={false} canImport={true} />
        </TestWrapper>
      );

      expect(screen.getByText(/use imported policy/i)).toBeInTheDocument();
    });

    it('should show manual label fields when "manual" routing selected', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Step2Content step1Completed={false} step1Skipped={false} canImport={true} />
        </TestWrapper>
      );

      const manualOption = screen.getByText(/enter label manually/i);
      await user.click(manualOption);

      expect(screen.getByPlaceholderText(/team/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/backend/i)).toBeInTheDocument();
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

      expect(screen.getByText(/rules yaml file/i)).toBeInTheDocument();
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

    it('should return false when manual routing but missing label name', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            rulesSource: 'datasource',
            rulesDatasourceUID: 'prometheus-uid',
            notificationPolicyOption: 'manual',
            manualLabelName: '',
            manualLabelValue: 'value',
            targetDatasourceUID: 'prometheus-uid',
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return false when manual routing but missing label value', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            rulesSource: 'datasource',
            rulesDatasourceUID: 'prometheus-uid',
            notificationPolicyOption: 'manual',
            manualLabelName: 'team',
            manualLabelValue: '',
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
            notificationPolicyOption: 'default',
            targetDatasourceUID: undefined,
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('should return true when all required fields are filled (datasource source, default policy)', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            rulesSource: 'datasource',
            rulesDatasourceUID: 'prometheus-uid',
            notificationPolicyOption: 'default',
            targetDatasourceUID: 'prometheus-uid',
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(true);
    });

    it('should return true when all required fields are filled (yaml source, default policy)', () => {
      const mockFile = new File(['test'], 'test.yaml', { type: 'text/yaml' });
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            rulesSource: 'yaml',
            rulesYamlFile: mockFile,
            notificationPolicyOption: 'default',
            targetDatasourceUID: 'prometheus-uid',
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(true);
    });

    it('should return true when all required fields are filled (datasource source, manual policy)', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            rulesSource: 'datasource',
            rulesDatasourceUID: 'prometheus-uid',
            notificationPolicyOption: 'manual',
            manualLabelName: 'team',
            manualLabelValue: 'backend',
            targetDatasourceUID: 'prometheus-uid',
          }}
        >
          <ValidationHookWrapper canImport={true} onResult={onResult} />
        </TestWrapper>
      );

      expect(onResult).toHaveBeenCalledWith(true);
    });

    it('should return true when all required fields are filled (datasource source, imported policy)', () => {
      const onResult = jest.fn();
      render(
        <TestWrapper
          defaultValues={{
            rulesSource: 'datasource',
            rulesDatasourceUID: 'prometheus-uid',
            notificationPolicyOption: 'imported',
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
});
