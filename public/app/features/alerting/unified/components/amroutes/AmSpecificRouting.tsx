import React, { FC } from 'react';
import { Route } from 'app/plugins/datasource/alertmanager/types';
import { AmRoutesTable } from './AmRoutesTable';

export interface AmSpecificRoutingProps {
  route: Route | undefined;
}

export const AmSpecificRouting: FC<AmSpecificRoutingProps> = ({ route }) => {
  return (
    <div>
      <h5>Specific routing</h5>
      <p>Send specific alerts to chosen channels, based on matching criteria</p>
      <AmRoutesTable routes={route?.routes ?? []} />
    </div>
  );
};
