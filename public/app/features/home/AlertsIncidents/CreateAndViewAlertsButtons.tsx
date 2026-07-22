import { Trans } from '@grafana/i18n';
import { LinkButton, Stack } from '@grafana/ui';

import { ctaClicked } from '../analytics/main';

interface Props {
  hasAlerts: boolean;
  canCreate: boolean;
  newRuleHref: string;
  viewAllHref: string;
}

export const CreateAndViewAlertsButtons = ({ hasAlerts, canCreate, newRuleHref, viewAllHref }: Props) => {
  return (
    <Stack justifyContent="flex-end" wrap="wrap">
      {hasAlerts && canCreate && (
        <LinkButton
          variant="secondary"
          size="sm"
          fill="text"
          icon="plus"
          href={newRuleHref}
          onClick={() => ctaClicked({ surface: 'alerts_card', action: 'create_rule', placement: 'footer' })}
        >
          <Trans i18nKey="home.firing-alerts-card.create">Create an alert rule</Trans>
        </LinkButton>
      )}

      <LinkButton
        variant="secondary"
        size="sm"
        fill="text"
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
      </LinkButton>
    </Stack>
  );
};
