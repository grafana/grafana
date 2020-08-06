import React, { FC } from 'react';
import { OperatorSegment } from './OperatorSegment';
import { AdHocVariableFilter } from 'app/features/variables/types';
import { SelectableValue } from '@grafana/data';
import { AdHocFilterKey } from './AdHocFilterKey';
import { AdHocFilterValue } from './AdHocFilterValue';

interface Props {
  datasource: string;
  filter: AdHocVariableFilter;
  onKeyChange: (item: SelectableValue<string | null>) => void;
  onOperatorChange: (item: SelectableValue<string>) => void;
  onValueChange: (item: SelectableValue<string>) => void;
  placeHolder?: string;
}

export const AdHocFilterRenderer: FC<Props> = ({
  datasource,
  filter: { key, operator, value },
  onKeyChange,
  onOperatorChange,
  onValueChange,
  placeHolder,
}) => {
  return (
    <>
      <AdHocFilterKey datasource={datasource} filterKey={key} onChange={onKeyChange} />
      <div className="gf-form">
        <OperatorSegment value={operator} onChange={onOperatorChange} />
      </div>
      <AdHocFilterValue
        datasource={datasource}
        filterKey={key}
        filterValue={value}
        onChange={onValueChange}
        placeHolder={placeHolder}
      />
    </>
  );
};
