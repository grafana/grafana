import { type MouseEvent } from 'react';

import { Trans } from '@grafana/i18n';
import { LinkButton, Stack } from '@grafana/ui';

import { type CtaClicked } from '../analytics/types';

interface Props {
  hasAlerts: boolean;
  canCreate: boolean;
  newRuleHref: string;
  viewAllHref: string;
  /** Emits the cta_clicked event; comes from useFiringAlerts so clicks carry the dwell and new-tab attributes. */
  track: (e: MouseEvent, props: Pick<CtaClicked, 'action' | 'placement' | 'severity'>) => void;
}

export const CreateAndViewAlertsButtons = ({ hasAlerts, canCreate, newRuleHref, viewAllHref, track }: Props) => {
  return (
    <Stack justifyContent="flex-end" wrap="wrap">
      {hasAlerts && canCreate && (
        <LinkButton
          variant="secondary"
          size="sm"
          fill="text"
          icon="plus"
          href={newRuleHref}
          onClick={(e) => track(e, { action: 'create_rule', placement: 'footer' })}
        >
          <Trans i18nKey="home.firing-alerts-card.create">Create an alert rule</Trans>
        </LinkButton>
      )}

      <LinkButton
        variant="secondary"
        size="sm"
        fill="text"
        href={viewAllHref}
        onClick={(e) =>
          track(e, {
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
