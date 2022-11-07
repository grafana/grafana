import React from 'react';

import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';

interface Props {
  onClick?: () => void;
}
export const EmptyCorrelationsCTA = ({ onClick }: Props) => {
  // TODO: if there are no datasources show a different message

  return (
    <EmptyListCTA
      title="You haven't defined any correlation yet."
      buttonIcon="gf-glue"
      onClick={onClick}
      buttonTitle="Add correlation"
      proTip="you can also define correlations via datasource provisioning"
    />
  );
};
