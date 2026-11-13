import { Trans } from '@grafana/i18n';

import { FooterAction } from '../FooterActions';
import { ctaClicked } from '../analytics/main';

interface ViewAllAlertsActionProps {
  hasAlerts: boolean;
  viewAllHref: string;
}

/** Links to the firing alerts while there are any, otherwise to the rules that could fire. */
export const ViewAllAlertsAction = ({ hasAlerts, viewAllHref }: ViewAllAlertsActionProps) => (
  <FooterAction
    href={viewAllHref}
    onClick={() =>
      ctaClicked({
        surface: 'alerts_card',
        action: hasAlerts ? 'view_all_alerts' : 'view_all_rules',
        placement: 'footer',
      })
    }
  >
    {hasAlerts ? (
      <Trans i18nKey="home.firing-alerts-card.view-all">View all firing alerts</Trans>
    ) : (
      <Trans i18nKey="home.firing-alerts-card.view-rules">View all alert rules</Trans>
    )}
  </FooterAction>
);
