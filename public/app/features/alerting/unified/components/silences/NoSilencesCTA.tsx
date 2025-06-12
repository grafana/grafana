import { Trans, t } from '@grafana/i18n';
import { CallToActionCard, EmptyState, LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { getInstancesPermissions } from '../../utils/access-control';
import { makeAMLink } from '../../utils/misc';

type Props = {
  alertManagerSourceName: string;
};

export const NoSilencesSplash = ({ alertManagerSourceName }: Props) => {
  const permissions = getInstancesPermissions(alertManagerSourceName);

  if (contextSrv.hasPermission(permissions.create)) {
    return (
      <EmptyState
        variant="call-to-action"
        button={
          <LinkButton href={makeAMLink('alerting/silence/new', alertManagerSourceName)} icon="bell-slash" size="lg">
            <Trans i18nKey="silences.empty-state.button-title">Create silence</Trans>
          </LinkButton>
        }
        message={t('silences.empty-state.title', "You haven't created any silences yet")}
      />
    );
  }
  return <CallToActionCard callToActionElement={<div />} message="No silences found." />;
};
