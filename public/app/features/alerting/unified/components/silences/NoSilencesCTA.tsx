import React from 'react';

import { CallToActionCard } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { contextSrv } from 'app/core/services/context_srv';

import { getInstancesPermissions } from '../../utils/access-control';
import { makeAMLink } from '../../utils/misc';

type Props = {
  alertManagerSourceName: string;
};

export const NoSilencesSplash = ({ alertManagerSourceName }: Props) => {
  const permissions = getInstancesPermissions(alertManagerSourceName);

  if (contextSrv.hasAccess(permissions.create, contextSrv.isEditor)) {
    return (
      <EmptyListCTA
        title="You haven't created any silences yet"
        buttonIcon="bell-slash"
        buttonLink={makeAMLink('alerting/silence/new', alertManagerSourceName)}
        buttonTitle="Create silence"
      />
    );
  }
  return <CallToActionCard callToActionElement={<div />} message="No silences found." />;
};
