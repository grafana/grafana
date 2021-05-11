import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import React, { FC } from 'react';
import { makeAMLink } from '../../utils/misc';

type Props = {
  alertManagerSourceName: string;
};

export const NoSilencesSplash: FC<Props> = ({ alertManagerSourceName }) => (
  <EmptyListCTA
    title="You haven't created any silences yet"
    buttonIcon="bell-slash"
    buttonLink={makeAMLink('alerting/silence/new', alertManagerSourceName)}
    buttonTitle="New silence"
  />
);
