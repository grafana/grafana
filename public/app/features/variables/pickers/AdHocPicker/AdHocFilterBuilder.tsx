import React, { FC, useState, ReactElement } from 'react';
import { SegmentAsync } from '@grafana/ui';
import { OperatorSegment } from './OperatorSegment';
import { AdHocVariableFilter } from 'app/features/templating/variable';
import { SelectableValue } from '@grafana/data';

interface Props {
  onLoadKeys: () => Promise<Array<SelectableValue<string>>>;
  onLoadValues: (key: string) => Promise<Array<SelectableValue<string>>>;
  onCompleted: (filter: AdHocVariableFilter) => void;
  appendBefore?: React.ReactNode;
}

export const AdHocFilterBuilder: FC<Props> = ({ appendBefore, onCompleted, onLoadKeys, onLoadValues }) => {
  const [key, setKey] = useState<string>('');
  const [operator, setOperator] = useState<string>('=');

  if (key === '') {
    return (
      <div className="gf-form">
        <SegmentAsync
          className="query-segment-key"
          Component={renderAddButton(key)}
          value={key}
          onChange={({ value }) => setKey(value ?? '')}
          loadOptions={onLoadKeys}
        />
      </div>
    );
  }

  return (
    <>
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
            setKey('');
            setOperator('=');
          }}
          loadOptions={() => onLoadValues(key)}
        />
      </div>
    </>
  );
};

function renderAddButton(key: string): ReactElement {
  return key !== '' ? (
    undefined
  ) : (
    <a className="gf-form-label query-part">
      <i className="fa fa-plus" />
    </a>
  );
}
