import { type TimeRange } from '@grafana/data';
import { InlineField, InlineFieldRow } from '@grafana/ui';

import { type TempoDatasource } from './datasource';
import { type TempoQuery } from './types';

interface Props {
  datasource: TempoDatasource;
  query: TempoQuery;
  onChange: (query: TempoQuery) => void;
  onRunQuery: () => void;
  range?: TimeRange;
}

export function FlowQuerySection(_props: Props) {
  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Flow filters" grow>
          <div />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
}
