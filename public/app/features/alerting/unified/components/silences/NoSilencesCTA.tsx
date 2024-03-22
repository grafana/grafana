import React from 'react';

import { LinkButton } from '@grafana/ui';
import { EmptyState } from '@grafana/ui/src/components/EmptyState/EmptyState';
import { Trans, t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';

import { getInstancesPermissions } from '../../utils/access-control';
import { makeAMLink } from '../../utils/misc';

type Props = {
  alertManagerSourceName: string;
};

export const NoSilencesSplash = ({ alertManagerSourceName }: Props) => {
  const permissions = getInstancesPermissions(alertManagerSourceName);

  return (
    <EmptyState
      button={
        <LinkButton
          disabled={!contextSrv.hasPermission(permissions.create)}
          href={makeAMLink('alerting/silence/new', alertManagerSourceName)}
          icon="bell-slash"
          size="lg"
        >
          <Trans i18nKey="silences.empty-state.button-title">Create silence</Trans>
        </LinkButton>
      }
      message={t('silences.empty-state.title', "You haven't created any silences yet")}
    />
  );
};
