import { Trans } from '@grafana/i18n';
import { LinkButton, Stack } from '@grafana/ui';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';

import { ctaClicked } from '../analytics/main';

interface Props {
  pluginId: string;
  hasIncidents: boolean;
  canDeclare: boolean;
  canAccess: boolean;
}

export const DeclareAndViewIncidentsButtons = ({ pluginId, hasIncidents, canDeclare, canAccess }: Props) => {
  return (
    <Stack justifyContent="flex-end" wrap="wrap">
      {hasIncidents && canDeclare && (
        <LinkButton
          variant="secondary"
          size="sm"
          fill="text"
          icon="fire"
          href={createBridgeURL(pluginId, '/incidents', { declare: 'new' })}
          onClick={() => ctaClicked({ surface: 'incidents_card', action: 'declare_incident', placement: 'footer' })}
        >
          <Trans i18nKey="home.incidents-card.declare">Declare an incident</Trans>
        </LinkButton>
      )}
      {canAccess && (
        <LinkButton
          variant="secondary"
          size="sm"
          fill="text"
          href={createBridgeURL(pluginId, '/incidents')}
          onClick={() => ctaClicked({ surface: 'incidents_card', action: 'view_all_incidents', placement: 'footer' })}
        >
          <Trans i18nKey="home.incidents-card.view-all">View all incidents</Trans>
        </LinkButton>
      )}
    </Stack>
  );
};
