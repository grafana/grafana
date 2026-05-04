import { useAsync } from 'react-use';

import { getDefaultRelativeTimeRange, getNextRefId, locationUtil, urlUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { Button, Modal } from '@grafana/ui';
import { RuleFormType } from 'app/features/alerting/unified/types/rule-form';
import { dataQueriesToGrafanaQueries, getDefaultExpressions } from 'app/features/alerting/unified/utils/rule-form';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';

interface Props {
  onDismiss: () => void;
  queries: DataQuery[];
}

export function ExploreToAlertingModal({ onDismiss, queries }: Props) {
  const { loading, value: formValues } = useAsync(async () => {
    if (!queries?.length) {
      return undefined;
    }

    const relativeTimeRange = getDefaultRelativeTimeRange();
    const grafanaQueries = await dataQueriesToGrafanaQueries(queries, relativeTimeRange, {});

    if (!grafanaQueries.length) {
      return undefined;
    }

    if (!grafanaQueries.find((q) => q.datasourceUid === ExpressionDatasourceUID)) {
      const lastQuery = grafanaQueries.at(-1)!;
      const reduceRefId = getNextRefId(grafanaQueries);
      const queriesWithReduce = [
        ...grafanaQueries,
        { refId: reduceRefId, datasourceUid: '', queryType: '', model: {} },
      ];
      const thresholdRefId = getNextRefId(queriesWithReduce);
      const expressions = getDefaultExpressions(reduceRefId, thresholdRefId, lastQuery.refId);
      grafanaQueries.push(...expressions);
    }

    return {
      type: RuleFormType.grafana,
      queries: grafanaQueries,
      condition: grafanaQueries.at(-1)!.refId,
    };
  }, [queries]);

  const buildUrl = () => urlUtil.renderUrl('/alerting/new', { defaults: JSON.stringify(formValues) });

  const openInNewTab = () => {
    window.open(locationUtil.assureBaseUrl(buildUrl()), '_blank');
    onDismiss();
  };

  const openInCurrentTab = () => locationService.push(buildUrl());

  const canCreate = !loading && formValues;

  return (
    <Modal title={t('explore.add-alert-rule.modal-title', 'Create alert rule')} isOpen onDismiss={onDismiss}>
      <p>
        {canCreate ? (
          <Trans i18nKey="explore.add-alert-rule.modal-description">
            Open the alert creation form in the current tab or a new tab?
          </Trans>
        ) : (
          <Trans i18nKey="explore.add-alert-rule.no-queries">
            No alerting-capable queries found. Please run a query first.
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
              <Trans i18nKey="explore.add-alert-rule.open-in-new-tab">Open in new tab</Trans>
            </Button>
            <Button variant="primary" onClick={openInCurrentTab} icon="bell">
              <Trans i18nKey="explore.add-alert-rule.open">Open</Trans>
            </Button>
          </>
        )}
      </Modal.ButtonRow>
    </Modal>
  );
}
