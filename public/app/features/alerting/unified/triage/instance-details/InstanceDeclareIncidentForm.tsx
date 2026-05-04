import { css } from '@emotion/css';

import { type GrafanaTheme2, textUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { usePluginComponent } from '@grafana/runtime';
import { Alert, LoadingPlaceholder, TextLink, useStyles2 } from '@grafana/ui';

import { DEFAULT_DECLARE_INCIDENT_PLUGIN_ID } from './declareIncidentDrilldown';

interface InstanceDeclareIncidentFormProps {
  incidentURL: string;
  pluginId: string;
  defaultTitle?: string;
  onDismiss: () => void;
}

interface DeclareIncidentModalProps {
  onDismiss?: () => void;
  defaultTitle?: string;
}

const FALLBACK_EXTENSION_ID = 'grafana-irm-app/declare-incident-modal/v1';

export function InstanceDeclareIncidentForm({
  incidentURL,
  pluginId,
  defaultTitle,
  onDismiss,
}: InstanceDeclareIncidentFormProps) {
  const styles = useStyles2(getStyles);
  const safeIncidentURL = textUtil.sanitizeUrl(incidentURL);
  const resolvedPluginId = pluginId || DEFAULT_DECLARE_INCIDENT_PLUGIN_ID;
  const preferredExtensionId = `${resolvedPluginId}/declare-incident-modal/v1`;
  const { component: PreferredDeclareIncidentModal, isLoading: isLoadingPreferredComponent } =
    usePluginComponent<DeclareIncidentModalProps>(preferredExtensionId);
  const { component: FallbackDeclareIncidentModal, isLoading: isLoadingFallbackComponent } =
    usePluginComponent<DeclareIncidentModalProps>(FALLBACK_EXTENSION_ID);

  const DeclareIncidentModal =
    PreferredDeclareIncidentModal ??
    (preferredExtensionId !== FALLBACK_EXTENSION_ID ? FallbackDeclareIncidentModal : null);
  const isLoadingComponent =
    isLoadingPreferredComponent || (preferredExtensionId !== FALLBACK_EXTENSION_ID && isLoadingFallbackComponent);

  return (
    <div className={styles.container}>
      {isLoadingComponent && (
        <LoadingPlaceholder
          text={t(
            'alerting.triage.instance-details-drawer.declare-incident-loading-component',
            'Loading incident form...'
          )}
        />
      )}
      {!isLoadingComponent && DeclareIncidentModal && (
        <div className={styles.formContainer}>
          <DeclareIncidentModal onDismiss={onDismiss} defaultTitle={defaultTitle} />
        </div>
      )}
      {!isLoadingComponent && !DeclareIncidentModal && (
        <Alert
          severity="warning"
          title={t(
            'alerting.triage.instance-details-drawer.declare-incident-unavailable-title',
            'Incident form is unavailable in this view'
          )}
        >
          <Trans i18nKey="alerting.triage.instance-details-drawer.declare-incident-unavailable-description">
            Open the incident form in a new tab if the in-app plugin form is not available.
          </Trans>
        </Alert>
      )}
      <TextLink href={safeIncidentURL} external>
        <Trans i18nKey="alerting.triage.instance-details-drawer.open-incident-new-tab">
          Open incident form in new tab
        </Trans>
      </TextLink>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    alignItems: 'stretch',
  }),
  formContainer: css({
    minHeight: 220,
  }),
});
