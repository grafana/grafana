import { memo, useCallback, useMemo, useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { isProvisionedResource } from 'app/features/alerting/unified/utils/k8s/utils';
import {
  type GrafanaManagedContactPoint,
  type GrafanaManagedReceiverConfig,
} from 'app/plugins/datasource/alertmanager/types';

import { alertRuleApi } from '../../../api/alertRuleApi';
import { useIntegrationTypeSchemas } from '../../../api/integrationSchemasApi';
import { useTestContactPoint } from '../../../hooks/useTestContactPoint';
import { type GrafanaChannelValues, type ReceiverFormValues } from '../../../types/receiver-form';
import { stringifyErrorLike } from '../../../utils/misc';
import { canCreateNotifier, hasLegacyIntegrations } from '../../../utils/notifier-versions';
import { grafanaReceiverToFormValues } from '../../../utils/receiver-form';
import { ImportedResourceAlert, ProvisionedResource, ProvisioningAlert } from '../../Provisioning';
import { FileExportPreview } from '../../export/FileExportPreview';
import { GrafanaExportDrawer } from '../../export/GrafanaExportDrawer';
import { type ExportFormats, HclExportProvider, allGrafanaExportProviders } from '../../export/providers';
import { ReceiverTypes } from '../grafanaAppReceivers/onCall/onCall';
import { useOnCallIntegration } from '../grafanaAppReceivers/onCall/useOnCallIntegration';

import { GrafanaCommonChannelSettings } from './GrafanaCommonChannelSettings';
import { ReceiverForm } from './ReceiverForm';
import { TestContactPointModal } from './TestContactPointModal';
import { type Notifier } from './notifiers';

const baseDefaultChannelValues = {
  __id: '',
  secureSettings: {},
  settings: {},
  secureFields: {},
  disableResolveMessage: false,
  // version is intentionally not set here - it will be determined by the notifier's currentVersion
  // when the integration is created/type is changed. The backend will use its default if not provided.
};

interface Props {
  contactPoint?: GrafanaManagedContactPoint;
}

export const GrafanaExportReceiverForm = ({ contactPoint }: Props) => {
  const {
    onCallNotifierMeta,
    extendOnCallNotifierFeatures,
    extendOnCallReceivers,
    onCallFormValidators,
    isLoadingOnCallIntegration,
    hasOnCallError,
  } = useOnCallIntegration();

  const { data: grafanaNotifiers = [], isLoading: isLoadingNotifiers } = useIntegrationTypeSchemas();

  // Pick a default integration type that is actually creatable. Prefer email for backwards compatibility;
  // fall back to the first creatable notifier if email has been disallowed via the allowed_integrations setting.
  const defaultChannelValues: GrafanaChannelValues = useMemo(() => {
    const emailNotifier = grafanaNotifiers.find((n) => n.type === 'email');
    const defaultNotifier =
      emailNotifier && canCreateNotifier(emailNotifier) ? emailNotifier : grafanaNotifiers.find(canCreateNotifier);
    return {
      ...baseDefaultChannelValues,
      type: defaultNotifier?.type ?? 'email',
    };
  }, [grafanaNotifiers]);

  const [testChannelData, setTestChannelData] = useState<{
    channelValues: GrafanaChannelValues;
    existingIntegration?: GrafanaManagedReceiverConfig;
  }>();

  const [exportData, setExportData] = useState<ReceiverFormValues<GrafanaChannelValues> | undefined>(undefined);

  const onClose = useCallback(() => {
    setExportData(undefined);
  }, [setExportData]);

  // transform receiver DTO to form values
  const [existingValue, id2original] = useMemo((): [
    ReceiverFormValues<GrafanaChannelValues> | undefined,
    Record<string, GrafanaManagedReceiverConfig>,
  ] => {
    if (!contactPoint || isLoadingNotifiers || isLoadingOnCallIntegration) {
      return [undefined, {}];
    }

    return grafanaReceiverToFormValues(extendOnCallReceivers(contactPoint));
  }, [contactPoint, isLoadingNotifiers, extendOnCallReceivers, isLoadingOnCallIntegration]);

  const onSubmit = async (values: ReceiverFormValues<GrafanaChannelValues>) => {
    setExportData(values);
  };

  const onTestChannel = (values: GrafanaChannelValues) => {
    const existing: GrafanaManagedReceiverConfig | undefined = id2original[values.__id];
    setTestChannelData({
      channelValues: values,
      existingIntegration: existing,
    });
  };

  const { canTest } = useTestContactPoint({
    contactPoint,
    defaultChannelValues,
  });

  // If there is no contact point it means we're creating a new one, so scoped permissions doesn't exist yet
  const isProvisioned = isProvisionedResource(contactPoint?.provenance);
  const isTestable = canTest;
  if (isLoadingNotifiers || isLoadingOnCallIntegration) {
    return (
      <LoadingPlaceholder text={t('alerting.grafana-receiver-form.text-loading-notifiers', 'Loading notifiers...')} />
    );
  }

  // Map notifiers to Notifier[] format for ReceiverForm
  // The grafanaNotifiers include version-specific options via the versions array from the backend
  const notifiers: Notifier[] = grafanaNotifiers.map((n) => {
    if (n.type === ReceiverTypes.OnCall) {
      return {
        dto: extendOnCallNotifierFeatures(n),
        meta: onCallNotifierMeta,
      };
    }

    return { dto: n };
  });

  return (
    <>
      {hasOnCallError && (
        <Alert
          severity="error"
          title={t(
            'alerting.grafana-receiver-form.title-loading-on-call-integration-failed',
            'Loading OnCall integration failed'
          )}
        >
          <Trans i18nKey="alerting.grafana-receiver-form.body-loading-on-call-integration-failed">
            Grafana OnCall plugin has been enabled in your Grafana instances but it is not reachable. Please check the
            plugin configuration
          </Trans>
        </Alert>
      )}

      {isProvisioned && hasLegacyIntegrations(contactPoint, grafanaNotifiers) && (
        <ImportedResourceAlert resource={ProvisionedResource.ContactPoint} />
      )}
      {isProvisioned && !hasLegacyIntegrations(contactPoint, grafanaNotifiers) && (
        <ProvisioningAlert resource={ProvisionedResource.ContactPoint} />
      )}

      <ReceiverForm<GrafanaChannelValues>
        contactPointId={contactPoint?.id}
        isEditable={true}
        isTestable={isTestable}
        onSubmit={onSubmit}
        initialValues={existingValue}
        onTestChannel={onTestChannel}
        notifiers={notifiers}
        alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
        defaultItem={{ ...defaultChannelValues }}
        commonSettingsComponent={GrafanaCommonChannelSettings}
        customValidators={{ [ReceiverTypes.OnCall]: onCallFormValidators }}
        canManagePermissions={false}
        canEditProtectedFields={true}
        modifyExport={true}
      />
      {testChannelData && (
        <TestContactPointModal
          onDismiss={() => setTestChannelData(undefined)}
          isOpen={!!testChannelData}
          contactPoint={contactPoint}
          channelValues={testChannelData.channelValues}
          existingIntegration={testChannelData.existingIntegration}
          defaultChannelValues={defaultChannelValues}
        />
      )}
      {exportData && (
        <GrafanaReceiverDesignExporter exportValues={exportData} onClose={onClose} contactPoint={contactPoint?.name} />
      )}
    </>
  );
};

interface GrafanaReceiverDesignExportPreviewProps {
  exportFormat: ExportFormats;
  onClose: () => void;
  exportValues: ReceiverFormValues<GrafanaChannelValues>;
}

const GrafanaReceiverDesignExportPreview = ({
  exportFormat,
  exportValues,
  onClose,
}: GrafanaReceiverDesignExportPreviewProps) => {
  const receivers = exportValues.items.map((item) => ({
    type: item.type,
    settings: item.settings,
    disableResolveMessage: item.disableResolveMessage ?? false,
  }));

  const contactPointExport = { name: exportValues.name, receivers: receivers };
  const { currentData, error, isLoading } = alertRuleApi.endpoints.exportModifiedReceiver.useQuery({
    payload: contactPointExport,
    format: exportFormat,
  });

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.grafana-rule-design-export-preview.text-loading', 'Loading....')} />;
  }

  if (error) {
    return (
      <Alert
        severity="error"
        title={t('alerting.export.contact-point-export-failed', 'Failed to export contact point')}
      >
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  const downloadFileName = `modify-export-cp-${contactPointExport.name}-${new Date().getTime()}`;

  return (
    <FileExportPreview
      format={exportFormat}
      textDefinition={currentData ?? ''}
      downloadFileName={downloadFileName}
      onClose={onClose}
    />
  );
};

interface GrafanaReceiverDesignExporterProps {
  onClose: () => void;
  exportValues: ReceiverFormValues<GrafanaChannelValues>;
  contactPoint?: string;
}

export const GrafanaReceiverDesignExporter = memo(
  ({ onClose, exportValues, contactPoint }: GrafanaReceiverDesignExporterProps) => {
    const exportingNewRule = !contactPoint;
    const initialTab = exportingNewRule ? 'hcl' : 'yaml';
    const [activeTab, setActiveTab] = useState<ExportFormats>(initialTab);

    const formatProviders = exportingNewRule ? [HclExportProvider] : Object.values(allGrafanaExportProviders);

    return (
      <GrafanaExportDrawer
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={onClose}
        formatProviders={formatProviders}
      >
        <GrafanaReceiverDesignExportPreview exportFormat={activeTab} onClose={onClose} exportValues={exportValues} />
      </GrafanaExportDrawer>
    );
  }
);

GrafanaReceiverDesignExporter.displayName = 'GrafanaReceiverDesignExporter';
