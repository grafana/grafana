import { AdHocVariableFilter, DataSourceRef, SelectableValue } from '@grafana/data';

import { AdHocFilterKey } from './AdHocFilterKey';
import { AdHocFilterValue } from './AdHocFilterValue';
import { OperatorSegment } from './OperatorSegment';

interface Props {
  datasource: DataSourceRef;
  filter: AdHocVariableFilter;
  allFilters: AdHocVariableFilter[];
  onKeyChange: (item: SelectableValue<string | null>) => void;
  onOperatorChange: (item: SelectableValue<string>) => void;
  onValueChange: (item: SelectableValue<string>) => void;
  placeHolder?: string;
  disabled?: boolean;
}

export const AdHocFilterRenderer = ({
  datasource,
  filter: { key, operator, value },
  onKeyChange,
  onOperatorChange,
  onValueChange,
  placeHolder,
  allFilters,
  disabled,
}: Props) => {
  return (
    <>
      <AdHocFilterKey
        disabled={disabled}
        datasource={datasource}
        filterKey={key}
        onChange={onKeyChange}
        allFilters={allFilters}
      />
      <div className="gf-form">
        <OperatorSegment disabled={disabled} value={operator} onChange={onOperatorChange} />
      </div>
      <AdHocFilterValue
        disabled={disabled}
        datasource={datasource}
        filterKey={key}
        filterValue={value}
        allFilters={allFilters}
        onChange={onValueChange}
        placeHolder={placeHolder}
      />
    </>
  );
};
