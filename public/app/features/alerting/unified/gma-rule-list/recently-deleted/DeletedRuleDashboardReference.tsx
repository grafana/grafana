import { t } from '@grafana/i18n';
import { TextLink } from '@grafana/ui';

import { makePanelLink } from '../../utils/misc';

import { DeletedRuleReviewField } from './DeletedRuleReviewField';

interface DeletedRuleDashboardReferenceProps {
  dashboardUid: string;
  panelId: number;
}

/** Link to the dashboard panel a deleted rule was attached to, so Review shows where it pointed. */
export function DeletedRuleDashboardReference({ dashboardUid, panelId }: DeletedRuleDashboardReferenceProps) {
  return (
    <DeletedRuleReviewField
      label={t('alerting.deleted-rules.review.dashboard-panel', 'Dashboard panel')}
      value={
        <TextLink href={makePanelLink(dashboardUid, String(panelId))} inline={false}>
          {t('alerting.deleted-rules.review.dashboard-panel-link', 'Dashboard {{dashboard}}, panel {{panel}}', {
            dashboard: dashboardUid,
            panel: panelId,
          })}
        </TextLink>
      }
    />
  );
}
