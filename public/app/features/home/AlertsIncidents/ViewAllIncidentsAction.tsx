import { Trans } from '@grafana/i18n';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';

import { FooterAction } from '../FooterActions';
import { ctaClicked } from '../analytics/main';

interface ViewAllIncidentsActionProps {
  pluginId: string;
  canAccess: boolean;
}

/** Links to the incidents list; nothing when the user cannot open that page. */
export const ViewAllIncidentsAction = ({ pluginId, canAccess }: ViewAllIncidentsActionProps) =>
  canAccess ? (
    <FooterAction
      href={createBridgeURL(pluginId, '/incidents')}
      onClick={() => ctaClicked({ surface: 'incidents_card', action: 'view_all_incidents', placement: 'footer' })}
    >
      <Trans i18nKey="home.incidents-card.view-all">View all incidents</Trans>
    </FooterAction>
  ) : null;
