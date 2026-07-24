import { Trans } from '@grafana/i18n';
import { Icon, Stack, TextLink } from '@grafana/ui';
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
        <TextLink
          inline={false}
          color="primary"
          variant="bodySmall"
          href={createBridgeURL(pluginId, '/incidents', { declare: 'new' })}
          onClick={() => ctaClicked({ surface: 'incidents_card', action: 'declare_incident', placement: 'footer' })}
        >
          {/* In children instead of the icon prop so it sits left of the text; the 1px lift optically centers the baseline-aligned svg in the text line */}
          <Stack alignItems="center">
            <Icon name="fire" size="xs" /> <Trans i18nKey="home.incidents-card.declare">Declare an incident</Trans>
          </Stack>
        </TextLink>
      )}
      {canAccess && (
        <TextLink
          inline={false}
          color="primary"
          variant="bodySmall"
          href={createBridgeURL(pluginId, '/incidents')}
          onClick={() => ctaClicked({ surface: 'incidents_card', action: 'view_all_incidents', placement: 'footer' })}
        >
          <Trans i18nKey="home.incidents-card.view-all">View all incidents</Trans>
        </TextLink>
      )}
    </Stack>
  );
};
