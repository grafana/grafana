import { css } from '@emotion/css';
import { useAsyncRetry } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { Modal, useStyles2, Stack, Alert, Button, Spinner, Text } from '@grafana/ui';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { checkDashboardCompatibility } from './api/compatibilityApi';

interface CompatibilityModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Handler called when modal is dismissed */
  onDismiss: () => void;
  /** Dashboard JSON to check (v1 or v2 schema) */
  dashboardJson: DashboardJson;
  /** UID of the datasource to check compatibility against */
  datasourceUid: string;
}

/**
 * Modal component that checks dashboard compatibility with a datasource.
 *
 * This modal is self-contained and handles its own data fetching. When opened,
 * it automatically triggers a compatibility check by calling the dashboard validator
 * backend API. It displays loading, error, or success states accordingly.
 *
 * This component is generic and works with any dashboard source:
 * - Community dashboards (GnetDashboard)
 * - Plugin-provided dashboards (PluginDashboard)
 * - User-created dashboards
 *
 * Features #12-15 will add detailed result displays (color-coded scores, missing
 * metrics lists, and query breakdowns).
 */
export const CompatibilityModal = ({ isOpen, onDismiss, dashboardJson, datasourceUid }: CompatibilityModalProps) => {
  const styles = useStyles2(getStyles);

  // Fetch compatibility results when modal opens
  const {
    value: result,
    loading,
    error,
    retry,
  } = useAsyncRetry(async () => {
    // Don't trigger API call if modal is closed
    if (!isOpen) {
      return null;
    }

    // Validate dashboard is v1 schema (reject v2 for MVP)
    // isDashboardV2Spec checks for 'elements' property at runtime
    if ('elements' in dashboardJson) {
      throw new Error(
        t(
          'compatibility-modal.v2-not-supported',
          'Dashboard v2 schema is not yet supported. Compatibility checking is currently only available for v1 dashboards. Support for v2 dashboards is coming soon.'
        )
      );
    }

    // Fetch datasource details to build mapping
    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    if (!ds) {
      throw new Error(
        t('compatibility-modal.datasource-not-found', 'Datasource not found with UID: {{uid}}', {
          uid: datasourceUid,
        })
      );
    }

    // Call compatibility check API with validated dashboard
    return await checkDashboardCompatibility(dashboardJson, [
      {
        uid: ds.uid,
        type: ds.type,
        name: ds.name,
      },
    ]);
  }, [isOpen, dashboardJson, datasourceUid]);

  return (
    <Modal
      title={t('compatibility-modal.title', 'Dashboard Compatibility Check for {{dashboardName}}', {
        dashboardName: dashboardJson.title || 'Dashboard',
      })}
      isOpen={isOpen}
      onDismiss={onDismiss}
      className={styles.modal}
      contentClassName={styles.modalContent}
    >
      <div className={styles.contentContainer}>
        {/* Loading State */}
        {loading && (
          <Stack direction="column" alignItems="center" gap={2}>
            <Spinner size="xl" />
            <Text>
              <Trans i18nKey="compatibility-modal.checking">Checking compatibility...</Trans>
            </Text>
          </Stack>
        )}

        {/* Error State */}
        {!loading && error && (
          <Stack direction="column" alignItems="center" gap={2}>
            <Alert title={t('compatibility-modal.error-title', 'Error checking compatibility')} severity="error">
              <Trans i18nKey="compatibility-modal.error-description">
                Failed to check dashboard compatibility. Please try again.
              </Trans>
            </Alert>
            <Button variant="secondary" onClick={retry}>
              <Trans i18nKey="compatibility-modal.retry">Retry</Trans>
            </Button>
          </Stack>
        )}

        {/* Success State - Placeholder for Features #12-15 */}
        {!loading && !error && result && (
          <Stack direction="column" gap={3}>
            <div>
              <Text element="h3">
                <Trans i18nKey="compatibility-modal.score-title">Compatibility Score</Trans>
              </Text>
              <Text element="p" variant="h2">
                {result.compatibilityScore}%
              </Text>

              <Text element="p">{JSON.stringify(result)}</Text>
            </div>

            {/* Feature #12: CompatibilityScoreDisplay with color coding */}
            {/* - Large score display with color coding (green >=80%, yellow 50-79%, red <50%) */}
            {/* - Icon based on score range (check-circle, warning, exclamation-circle) */}
            {/* - Descriptive text: 'Highly Compatible', 'Partially Compatible', 'Low Compatibility' */}

            {/* Feature #13: DatasourceResultSection component */}
            {/* - Display datasource name and type */}
            {/* - Show total queries vs checked queries count */}
            {/* - Show total metrics vs found metrics count */}
            {/* - Display number of missing metrics */}

            {/* Feature #14: MissingMetricsList component */}
            {/* - Collapsible/expandable section with missing metrics */}
            {/* - Show count of missing metrics in header */}
            {/* - Display bullet list of missing metric names when expanded */}
            {/* - Add copy-to-clipboard button for metric names */}
            {/* - Show 'All metrics found!' message when missingMetrics array is empty */}

            {/* Feature #15: QueryBreakdownTable component */}
            {/* - Collapsible section with 'Show panel breakdown' toggle */}
            {/* - Table with columns: Panel Title, Panel ID, Query Ref, Metrics Found/Total, Compatibility % */}
            {/* - Color-code compatibility percentage in table cells */}
            {/* - Add sorting capability by compatibility score */}
            {/* - Show expandable row details with missing metrics list per query */}
          </Stack>
        )}
      </div>
    </Modal>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '90%',
      maxWidth: '1200px',
      height: '80vh',
      display: 'flex',
      flexDirection: 'column',
    }),
    modalContent: css({
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: theme.spacing(3),
      height: '100%',
    }),
    contentContainer: css({
      flex: 1,
      overflow: 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
  };
}
