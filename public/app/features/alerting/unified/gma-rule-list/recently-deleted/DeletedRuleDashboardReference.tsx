import { t } from '@grafana/i18n';
import { TextLink } from '@grafana/ui';

import { type DashboardResponse, useDashboardQuery } from '../../components/rule-editor/useDashboardQuery';
import { makePanelLink } from '../../utils/misc';

import { DeletedRuleReviewField } from './DeletedRuleReviewField';

interface DeletedRuleDashboardReferenceProps {
  dashboardUid: string;
  panelId: number;
}

/** Link to the dashboard panel a deleted rule was attached to, so Review shows where it pointed. */
export function DeletedRuleDashboardReference({ dashboardUid, panelId }: DeletedRuleDashboardReferenceProps) {
  const { dashboard } = useDashboardQuery(dashboardUid);
  // The hook keeps the previous dashboard while a new uid loads, so a mismatched result must not be shown.
  const resolved = dashboard && getDashboardUid(dashboard) === dashboardUid ? dashboard : undefined;
  const dashboardTitle = resolved ? getDashboardTitle(resolved) : undefined;
  const panelTitle = resolved ? findPanelTitle(resolved, panelId) : undefined;

  return (
    <DeletedRuleReviewField
      label={t('alerting.deleted-rules.review.dashboard-panel', 'Dashboard panel')}
      value={
        <TextLink href={makePanelLink(dashboardUid, String(panelId))} inline={false}>
          {linkText(dashboardUid, panelId, dashboardTitle, panelTitle)}
        </TextLink>
      }
    />
  );
}

function linkText(dashboardUid: string, panelId: number, dashboardTitle?: string, panelTitle?: string) {
  if (!dashboardTitle) {
    return t('alerting.deleted-rules.review.dashboard-panel-link', 'Dashboard {{dashboard}}, panel {{panel}}', {
      dashboard: dashboardUid,
      panel: panelId,
    });
  }

  if (!panelTitle) {
    return t('alerting.deleted-rules.review.dashboard-panel-link-untitled', '{{dashboard}} › Panel {{panel}}', {
      dashboard: dashboardTitle,
      panel: panelId,
    });
  }

  return t('alerting.deleted-rules.review.dashboard-panel-link-titled', '{{dashboard}} › {{panel}}', {
    dashboard: dashboardTitle,
    panel: panelTitle,
  });
}

function getDashboardUid(dashboard: DashboardResponse) {
  return 'dashboard' in dashboard ? dashboard.dashboard.uid : dashboard.metadata.name;
}

function getDashboardTitle(dashboard: DashboardResponse) {
  return 'dashboard' in dashboard ? dashboard.dashboard.title : dashboard.spec.title;
}

function findPanelTitle(dashboard: DashboardResponse, panelId: number): string | undefined {
  if ('dashboard' in dashboard) {
    // Collapsed rows keep their panels nested; expanded rows list them at the top level.
    const panels = (dashboard.dashboard.panels ?? []).flatMap((panel) => [panel, ...(panel.panels ?? [])]);
    return panels.find((panel) => panel.id === panelId && panel.type !== 'row')?.title;
  }

  return Object.values(dashboard.spec.elements).find((element) => element.spec.id === panelId)?.spec.title;
}
