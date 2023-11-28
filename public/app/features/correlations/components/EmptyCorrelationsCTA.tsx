import React from 'react';

import { Card } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';

interface Props {
  onClick?: () => void;
  canWriteCorrelations: boolean;
}
export const EmptyCorrelationsCTA = ({ onClick, canWriteCorrelations }: Props) => {
  // TODO: if there are no datasources show a different message

  return canWriteCorrelations ? (
    <EmptyListCTA
      title="You haven't defined any correlation yet."
      buttonIcon="gf-glue"
      onClick={onClick}
      buttonTitle="Add correlation"
      proTip="you can also define correlations via datasource provisioning"
    />
  ) : (
    <Card>
      <Card.Heading>There are no correlations configured yet.</Card.Heading>
      <Card.Description>Please contact your administrator to create new correlations.</Card.Description>
    </Card>
  );
};
