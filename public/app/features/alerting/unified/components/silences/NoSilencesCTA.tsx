import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import React, { FC } from 'react';
import { config } from '@grafana/runtime';

export const NoSilencesSplash: FC = () => (
  <EmptyListCTA
    title="You haven't created any silences yet"
    buttonIcon="bell-slash"
    buttonLink={`${config.appSubUrl ?? ''}alerting/silences/new`}
    buttonTitle="New silence"
  />
);
