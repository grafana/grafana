import React, { FunctionComponent } from 'react';

import { Input, Switch } from '@grafana/ui';

import { SELECT_WIDTH } from '../constants';

import { QueryEditorRow } from '.';

export interface Props {
  refId: string;
  onChange: (period: string) => void;
  graphPeriod?: string;
}

export const GraphPeriod: FunctionComponent<Props> = ({ refId, onChange, graphPeriod }) => {
  return (
    <>
      <QueryEditorRow
        label="Graph period"
        htmlFor={`${refId}-graph-period`}
        tooltip={
          <>
            Set <code>graph_period</code> which forces a preferred period between points. Automatically set to the
            current interval if left blank.
          </>
        }
      >
        <Switch
          data-testid={`${refId}-switch-graph-period`}
          value={graphPeriod !== 'disabled'}
          onChange={(e) => onChange(e.currentTarget.checked ? '' : 'disabled')}
        />
        <Input
          label="value"
          id={`${refId}-graph-period`}
          width={SELECT_WIDTH}
          placeholder={'auto'}
          value={graphPeriod}
          onChange={(e) => onChange(e.currentTarget.value)}
          disabled={graphPeriod === 'disabled'}
        />
      </QueryEditorRow>
    </>
  );
};
