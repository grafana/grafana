import { CallToActionCard } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { contextSrv } from 'app/core/services/context_srv';
import React, { FC } from 'react';
import { makeAMLink } from '../../utils/misc';

type Props = {
  alertManagerSourceName: string;
};

export const NoSilencesSplash: FC<Props> = ({ alertManagerSourceName }) => {
  if (contextSrv.isEditor) {
    return (
      <EmptyListCTA
        title="You haven't created any silences yet"
        buttonIcon="bell-slash"
        buttonLink={makeAMLink('alerting/silence/new', alertManagerSourceName)}
        buttonTitle="New silence"
      />
    );
  }
  return <CallToActionCard callToActionElement={<div />} message="No silences found." />;
};
