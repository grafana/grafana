import { Trans } from '@grafana/i18n';
import { Icon, Stack, TextLink } from '@grafana/ui';

import { ctaClicked } from '../analytics/main';

interface Props {
  hasAlerts: boolean;
  canCreate: boolean;
  newRuleHref: string;
  viewAllHref: string;
}

export const CreateAndViewAlertsButtons = ({ hasAlerts, canCreate, newRuleHref, viewAllHref }: Props) => {
  return (
    <Stack justifyContent="flex-end" wrap="wrap" gap={2.5}>
      {hasAlerts && canCreate && (
        <TextLink
          inline={false}
          color="primary"
          variant="bodySmall"
          href={newRuleHref}
          onClick={() => ctaClicked({ surface: 'alerts_card', action: 'create_rule', placement: 'footer' })}
        >
          {/* In children instead of the icon prop so it sits left of the text; the 1px lift optically centers the baseline-aligned svg in the text line */}
          <Stack alignItems="center">
            <Icon name="plus" size="xs" /> <Trans i18nKey="home.firing-alerts-card.create">Create an alert rule</Trans>
          </Stack>
        </TextLink>
      )}

      <TextLink
        inline={false}
        color="primary"
        variant="bodySmall"
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
      </TextLink>
    </Stack>
  );
};
