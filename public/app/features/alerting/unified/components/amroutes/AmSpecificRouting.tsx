import { SelectableValue } from '@grafana/data';
import React, { FC } from 'react';
import { Receiver, Route } from 'app/plugins/datasource/alertmanager/types';
import { AmRoutesTable } from './AmRoutesTable';

export interface AmSpecificRoutingProps {
  route: Route | undefined;
  receivers: Array<SelectableValue<Receiver['name']>>;
}

export const AmSpecificRouting: FC<AmSpecificRoutingProps> = ({ route, receivers }) => {
  return (
    <div>
      <h5>Specific routing</h5>
      <p>Send specific alerts to chosen channels, based on matching criteria</p>
      <AmRoutesTable routes={route?.routes ?? []} receivers={receivers} />
    </div>
  );
};
