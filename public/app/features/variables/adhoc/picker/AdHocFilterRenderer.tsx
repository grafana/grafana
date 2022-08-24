import React, { FC } from 'react';

import { DataSourceRef, SelectableValue } from '@grafana/data';
import { AdHocVariableFilter } from 'app/features/variables/types';

import { AdHocFilterKey } from './AdHocFilterKey';
import { AdHocFilterValue } from './AdHocFilterValue';
import { OperatorSegment } from './OperatorSegment';

interface Props {
  datasource: DataSourceRef;
  filter: AdHocVariableFilter;
  onKeyChange: (item: SelectableValue<string | null>) => void;
  onOperatorChange: (item: SelectableValue<string>) => void;
  onValueChange: (item: SelectableValue<string>) => void;
  placeHolder?: string;
  getTagKeysOptions?: any;
  disabled?: boolean;
}

export const AdHocFilterRenderer: FC<Props> = ({
  datasource,
  filter: { key, operator, value },
  onKeyChange,
  onOperatorChange,
  onValueChange,
  placeHolder,
  getTagKeysOptions,
  disabled,
}) => {
  return (
    <>
      <AdHocFilterKey
        disabled={disabled}
        datasource={datasource}
        filterKey={key}
        onChange={onKeyChange}
        getTagKeysOptions={getTagKeysOptions}
      />
      <div className="gf-form">
        <OperatorSegment disabled={disabled} value={operator} onChange={onOperatorChange} />
      </div>
      <AdHocFilterValue
        disabled={disabled}
        datasource={datasource}
        filterKey={key}
        filterValue={value}
        onChange={onValueChange}
        placeHolder={placeHolder}
      />
    </>
  );
};
