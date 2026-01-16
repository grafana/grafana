import { useAsync } from 'react-use';

import { RawTimeRange, getNextRefId, locationUtil, urlUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { Button, Modal } from '@grafana/ui';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';

import { RuleFormType } from '../types/rule-form';
import {
  dataQueriesToGrafanaQueries,
  getDefaultReduceExpression,
  getDefaultThresholdExpression,
} from '../utils/rule-form';

/**
 * Props for the CreateAlertFromPanel exposed component.
 *
 * NOTE: We accept plain panel data rather than a VizPanel scene object because:
 *
 * 1. The plugin extension system wraps props in Proxies, which breaks `instanceof`
 *    checks used by scene graph utilities (e.g., `getQueryRunnerFor`, `sceneGraph.getTimeRange`).
 *
 * 2. When a VizPanel is passed through the extension system, code like:
 *    `if (dataProvider instanceof SceneQueryRunner)` returns false
 *    even when dataProvider IS a SceneQueryRunner (just wrapped in a Proxy).
 *
 * 3. Drilldown apps (like Metrics Drilldown) already have access to the raw panel data
 *    and can easily interpolate variables before passing to this component.
 *
 * This approach provides a stable, explicit contract that doesn't depend on
 * scene internals or class identity checks.
 */
export interface CreateAlertFromPanelProps {
  /**
   * Panel data containing the information needed to create an alert rule.
   * The consumer is responsible for interpolating any template variables
   * before passing this data.
   */
  panel: {
    /** Panel title, used as the default alert rule name */
    title?: string;
    /** Query targets with expressions already interpolated */
    targets: DataQuery[];
    /** Datasource reference */
    datasource?: DataSourceRef;
    /** Max data points for the query */
    maxDataPoints?: number;
  };
  /**
   * Optional time range. If provided, used for context.
   * The alert rule will use a relative time range (default: 10 minutes).
   */
  range?: { raw: RawTimeRange };
  /** Callback when the modal is dismissed */
  onDismiss: () => void;
}

/**
 * EXPOSED COMPONENT (stable): grafana/alerting/create-alert-from-panel/v1
 *
 * This component is exposed to plugins via the Plugin Extensions system.
 * Treat its props and user-visible behavior as a stable contract. Do not make
 * breaking changes in-place. If you need to change the API or behavior in a
 * breaking way, create a new versioned component (e.g. v2) and register it
 * under a new ID: "grafana/alerting/create-alert-from-panel/v2".
 *
 * This component is designed for use by plugin apps (like Metrics Drilldown)
 * that have panel data but are NOT part of a dashboard. It displays a modal
 * allowing the user to open the alert creation form in the current tab or
 * a new tab.
 *
 * Usage from a plugin:
 * ```tsx
 * import { usePluginComponent } from '@grafana/runtime';
 *
 * const { component: CreateAlertModal } = usePluginComponent(
 *   'grafana/alerting/create-alert-from-panel/v1'
 * );
 *
 * // Render with interpolated panel data
 * <CreateAlertModal
 *   panel={{
 *     title: 'My Panel',
 *     targets: [{ refId: 'A', expr: 'up{job="prometheus"}' }],
 *     datasource: { uid: 'prometheus-uid', type: 'prometheus' },
 *     maxDataPoints: 500,
 *   }}
 *   onDismiss={() => setShowModal(false)}
 * />
 * ```
 */
export const CreateAlertFromPanelExposedComponent = (props: Partial<CreateAlertFromPanelProps>) => {
  const { panel, onDismiss = () => {} } = props;

  const { loading, value: formValues } = useAsync(async () => {
    if (!panel?.targets?.length) {
      return undefined;
    }

    // Default relative time range of 10 minutes (600 seconds)
    const relativeTimeRange = { from: 600, to: 0 };

    // Convert panel queries to Grafana alert queries format
    const grafanaQueries = await dataQueriesToGrafanaQueries(
      panel.targets,
      relativeTimeRange,
      {}, // scopedVars - consumer should have already interpolated variables
      panel.datasource,
      panel.maxDataPoints
    );

    if (!grafanaQueries.length) {
      return undefined;
    }

    // Add default reduce + threshold expressions if no expressions exist.
    // This provides a sensible default alert condition for simple queries.
    if (!grafanaQueries.find((q) => q.datasourceUid === ExpressionDatasourceUID)) {
      const lastQuery = grafanaQueries.at(-1)!;

      const reduceExpr = getDefaultReduceExpression({
        inputRefId: lastQuery.refId,
        reduceRefId: getNextRefId(grafanaQueries),
      });
      grafanaQueries.push(reduceExpr);

      const thresholdExpr = getDefaultThresholdExpression({
        inputRefId: reduceExpr.refId,
        thresholdRefId: getNextRefId(grafanaQueries),
      });
      grafanaQueries.push(thresholdExpr);
    }

    return {
      type: RuleFormType.grafana,
      queries: grafanaQueries,
      name: panel.title || '',
      condition: grafanaQueries.at(-1)!.refId,
      // No folder - user selects in alert form
      // No dashboard/panel annotations - this is a standalone panel
    };
  }, [panel]);

  // If no panel provided, render nothing
  if (!panel) {
    return null;
  }

  const buildUrl = () => urlUtil.renderUrl('/alerting/new', { defaults: JSON.stringify(formValues) });

  const openInNewTab = () => {
    window.open(locationUtil.assureBaseUrl(buildUrl()), '_blank');
    onDismiss();
  };

  const openInCurrentTab = () => locationService.push(buildUrl());

  const canCreate = !loading && formValues;

  return (
    <Modal title={t('alerting.create-alert-from-panel.title', 'Create alert rule')} isOpen onDismiss={onDismiss}>
      <p>
        {canCreate ? (
          <Trans i18nKey="alerting.create-alert-from-panel.description">
            Open the alert creation form in the current tab or a new tab?
          </Trans>
        ) : (
          <Trans i18nKey="alerting.create-alert-from-panel.no-queries">
            No alerting-capable queries found in this panel.
          </Trans>
        )}
      </p>
      <Modal.ButtonRow>
        <Button onClick={onDismiss} fill="outline" variant="secondary">
          <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
        </Button>
        {canCreate && (
          <>
            <Button variant="secondary" onClick={openInNewTab} icon="external-link-alt">
              <Trans i18nKey="alerting.create-alert-from-panel.open-in-new-tab">Open in new tab</Trans>
            </Button>
            <Button variant="primary" onClick={openInCurrentTab} icon="bell">
              <Trans i18nKey="alerting.create-alert-from-panel.open">Open</Trans>
            </Button>
          </>
        )}
      </Modal.ButtonRow>
    </Modal>
  );
};
