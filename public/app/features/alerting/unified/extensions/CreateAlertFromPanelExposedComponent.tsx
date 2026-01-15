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

export interface CreateAlertFromPanelProps {
  panel: {
    title?: string;
    targets: DataQuery[];
    datasource?: DataSourceRef;
    maxDataPoints?: number;
  };
  range?: { raw: RawTimeRange };
  onDismiss: () => void;
}

export function CreateAlertFromPanelExposedComponent({ panel, range, onDismiss }: CreateAlertFromPanelProps) {
  const { loading, value: formValues } = useAsync(async () => {
    const relativeTimeRange = range?.raw ? { from: 600, to: 0 } : { from: 600, to: 0 };

    const grafanaQueries = await dataQueriesToGrafanaQueries(
      panel.targets,
      relativeTimeRange,
      {},
      panel.datasource,
      panel.maxDataPoints
    );

    if (!grafanaQueries.length) {
      return undefined;
    }

    // Add reduce + threshold if no expressions exist
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
    };
  }, [panel, range]);

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
}
