import React, { FC, ReactElement, useState } from 'react';
import { Icon, SegmentAsync } from '@grafana/ui';
import { OperatorSegment } from './OperatorSegment';
import { AdHocVariableFilter } from 'app/features/variables/types';
import { SelectableValue } from '@grafana/data';

interface Props {
  onLoadKeys: () => Promise<Array<SelectableValue<string>>>;
  onLoadValues: (key: string) => Promise<Array<SelectableValue<string>>>;
  onCompleted: (filter: AdHocVariableFilter) => void;
  appendBefore?: React.ReactNode;
}

export const AdHocFilterBuilder: FC<Props> = ({ appendBefore, onCompleted, onLoadKeys, onLoadValues }) => {
  const [key, setKey] = useState<string | null>(null);
  const [operator, setOperator] = useState<string>('=');

  if (key === null) {
    return (
      <div className="gf-form">
        <SegmentAsync
          className="query-segment-key"
          Component={filterAddButton(key)}
          value={key}
          onChange={({ value }) => setKey(value ?? '')}
          loadOptions={onLoadKeys}
        />
      </div>
    );
  }

  return (
    <React.Fragment key="filter-builder">
      {appendBefore}
      <div className="gf-form">
        <SegmentAsync
          className="query-segment-key"
          value={key}
          onChange={({ value }) => setKey(value ?? '')}
          loadOptions={onLoadKeys}
        />
      </div>
      <div className="gf-form">
        <OperatorSegment value={operator} onChange={({ value }) => setOperator(value ?? '')} />
      </div>
      <div className="gf-form">
        <SegmentAsync
          className="query-segment-value"
          placeholder="select value"
          onChange={({ value }) => {
            onCompleted({
              value: value ?? '',
              operator: operator,
              condition: '',
              key: key,
            });
            setKey(null);
            setOperator('=');
          }}
          loadOptions={() => onLoadValues(key)}
        />
      </div>
    </React.Fragment>
  );
};

function filterAddButton(key: string | null): ReactElement | undefined {
  if (key !== null) {
    return undefined;
  }

  return (
    <a className="gf-form-label query-part">
      <Icon name="plus" />
    </a>
  );
}
