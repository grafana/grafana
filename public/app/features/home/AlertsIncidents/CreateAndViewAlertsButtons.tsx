import { Trans } from '@grafana/i18n';

import { FooterAction, FooterActions } from '../FooterActions';
import { ctaClicked } from '../analytics/main';

interface Props {
  hasAlerts: boolean;
  canCreate: boolean;
  newRuleHref: string;
  viewAllHref: string;
}

export const CreateAndViewAlertsButtons = ({ hasAlerts, canCreate, newRuleHref, viewAllHref }: Props) => {
  return (
    <FooterActions>
      {hasAlerts && canCreate && (
        <FooterAction
          icon="plus"
          href={newRuleHref}
          onClick={() => ctaClicked({ surface: 'alerts_card', action: 'create_rule', placement: 'footer' })}
        >
          <Trans i18nKey="home.firing-alerts-card.create">Create an alert rule</Trans>
        </FooterAction>
      )}

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
    </FooterActions>
  );
};
