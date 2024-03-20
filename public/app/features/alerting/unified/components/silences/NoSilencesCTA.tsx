import React from 'react';

import { EmptyState } from '@grafana/ui/src/components/EmptyState/EmptyState';
import { t } from 'app/core/internationalization';
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
      buttonHref={makeAMLink('alerting/silence/new', alertManagerSourceName)}
      buttonLabel={
        contextSrv.hasPermission(permissions.create)
          ? t('silences.empty-state.button-title', 'Create silence')
          : undefined
      }
      message={t('silences.empty-state.title', "You haven't created any silences yet")}
    />
  );
};
